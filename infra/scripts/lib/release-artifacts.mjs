import { createHash } from "node:crypto";
import { posix } from "node:path";
import { isImageRepository, isRegistryNamespace, validateBuildManifest } from "./runtime-artifacts.mjs";
import { recoveryConnectionFields } from "./recovery-connections.mjs";

export const digestBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const releaseFiles = ["compose.json", "postgres-init.sql", "ports.json"];

const exactFields = (value, fields) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
const timestamp = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const databasePath = (value) => typeof value === "string" && value.startsWith("/") && value !== "/" && posix.normalize(value) === value && !/[\0\r\n]/.test(value);
const hex = (value, length) => typeof value === "string" && new RegExp("^[a-f0-9]{" + length + "}$").test(value);

export function validateRestoredBinding(value) {
  const fields = ["schema", "mode", "restoreOperationId", "backupId", "manifestSha256", "catalogSha256", "restoredAt", "container", "network", "volume", "source", "databases"];
  if (!exactFields(value, fields) || value.schema !== "magictools-restored-database/1" || value.mode !== "restored" ||
    !hex(value.restoreOperationId, 16) || !hex(value.backupId, 16) || !hex(value.manifestSha256, 64) || !hex(value.catalogSha256, 64) || !timestamp(value.restoredAt)) throw new Error("恢复数据库绑定的来源字段无效");
  const { container, network, volume, source } = value;
  if (!exactFields(container, ["name", "id"]) || typeof container.name !== "string" || !/^[a-z][a-z0-9-]{2,62}$/.test(container.name) || !hex(container.id, 64) ||
    !exactFields(network, ["name", "id"]) || network.name !== container.name + "-net" || !hex(network.id, 64) ||
    !exactFields(volume, ["name", "createdAt"]) || volume.name !== container.name + "-data" || !timestamp(volume.createdAt)) throw new Error("恢复数据库绑定的容器、网络或卷身份无效");
  if (!exactFields(source, ["systemIdentifier", "serverVersion", "image", "dataDirectory", "configFile"]) || typeof source.systemIdentifier !== "string" || !/^[1-9][0-9]{0,19}$/.test(source.systemIdentifier) ||
    !Number.isSafeInteger(source.serverVersion) || Math.floor(source.serverVersion / 10000) !== 16 ||
    !exactFields(source.image, ["reference", "platform"]) || typeof source.image.platform !== "string" || !/^linux\/(amd64|arm64)$/.test(source.image.platform) ||
    typeof source.image.reference !== "string" || !/@sha256:[a-f0-9]{64}$/.test(source.image.reference) || !isImageRepository(source.image.reference.split("@")[0]) ||
    !databasePath(source.dataDirectory) || !databasePath(source.configFile) || !source.configFile.startsWith(source.dataDirectory + "/")) throw new Error("恢复数据库绑定的镜像或PG配置无效");
  if (!Array.isArray(value.databases) || !value.databases.length || new Set(value.databases).size !== value.databases.length ||
    value.databases.some((name) => typeof name !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(name))) throw new Error("恢复数据库绑定的业务库清单无效");
  return { schema: value.schema, mode: value.mode, restoreOperationId: value.restoreOperationId, backupId: value.backupId, manifestSha256: value.manifestSha256, catalogSha256: value.catalogSha256, restoredAt: value.restoredAt,
    container: { name: container.name, id: container.id }, network: { name: network.name, id: network.id }, volume: { name: volume.name, createdAt: volume.createdAt },
    source: { systemIdentifier: source.systemIdentifier, serverVersion: source.serverVersion, image: { reference: source.image.reference, platform: source.image.platform },
      dataDirectory: source.dataDirectory, configFile: source.configFile }, databases: [...value.databases].sort() };
}

export function validateReleaseManifest(release, catalog, { allowValidation = false } = {}) {
  if (release?.schema !== "magictools-release/1" || release.success !== true) throw new Error("发布清单未成功完成");
  if (release.mode !== "release" && !(release.mode === "validation" && allowValidation)) throw new Error("验证制品不能用于正式部署");
  if (typeof release.releaseId !== "string" || !release.releaseId.startsWith(release.revision + "-") || !/^[a-z0-9-]{1,120}$/.test(release.releaseId)) throw new Error("发布标识无效");
  if (!Array.isArray(release.images)) throw new Error("发布镜像缺失");
  for (const item of release.images) {
    if (!isRegistryNamespace(item.repository) || !item.repository.endsWith("/" + item.service) ||
      !/^sha256:[a-f0-9]{64}$/.test(item.registryDigest) || item.reference !== item.repository + "@" + item.registryDigest) throw new Error("镜像必须固定实际 registry digest");
  }
  validateBuildManifest({ ...release, schema: "magictools-image-build/1", images: release.images.map((item) => ({ ...item, reference: item.repository + ":" + release.revision })) }, catalog);
  if (!Array.isArray(release.files) || release.files.length !== releaseFiles.length ||
    JSON.stringify(release.files.map((item) => item.path).sort()) !== JSON.stringify([...releaseFiles].sort()) ||
    release.files.some((item) => !/^[a-f0-9]{64}$/.test(item.sha256))) throw new Error("发布运行配置文件缺失或校验和非法");
  return release;
}

export function validateDeploymentConfig(config) {
  const restored = config?.schema === "magictools-deployment-config/2";
  const keys = ["schema", "project", "gatewayBind", "gatewayPort", "waitTimeoutSeconds", ...(restored ? ["database"] : [])];
  if (!config || Object.keys(config).some((key) => !keys.includes(key)) || (!restored && config.schema !== "magictools-deployment-config/1")) throw new Error("部署公开配置无效，秘密应使用独立 env 文件");
  if (typeof config.project !== "string" || !/^[a-z][a-z0-9-]{2,48}$/.test(config.project)) throw new Error("部署项目名非法");
  if (!["127.0.0.1", "0.0.0.0"].includes(config.gatewayBind)) throw new Error("网关绑定地址必须显式选择本机或全部接口");
  if (!Number.isInteger(config.gatewayPort) || config.gatewayPort < 1 || config.gatewayPort > 65535) throw new Error("网关端口非法");
  if (!Number.isInteger(config.waitTimeoutSeconds) || config.waitTimeoutSeconds < 30 || config.waitTimeoutSeconds > 900) throw new Error("就绪等待须为30至900秒");
  const canonical = Object.fromEntries(keys.map((key) => [key, config[key]]));
  if (restored) canonical.database = validateRestoredBinding(config.database);
  return { config: canonical, configVersion: digestBytes(JSON.stringify(canonical)) };
}

export function renderReleaseCompose(base, release, catalog, config) {
  validateDeploymentConfig(config);
  const expected = new Set(["postgres", ...catalog.map((item) => item.service)]);
  if (!base.services || Object.keys(base.services).length !== expected.size || Object.keys(base.services).some((key) => !expected.has(key))) throw new Error("发布 Compose 与服务清单不一致");
  if (config.schema === "magictools-deployment-config/2") {
    const apps = catalog.filter((item) => item.kind === "node" && item.app !== "gateway").map((item) => item.app).sort();
    if (catalog.some((item) => config.database.container.name === item.service || config.database.container.name === config.project + "-" + item.service + "-1")) throw new Error("恢复数据库名称与应用名称存在冲突");
    if (JSON.stringify([...config.database.databases].sort()) !== JSON.stringify(apps)) throw new Error("恢复绑定未覆盖部署业务库清单");
    if (Object.keys(base).some((key) => !["name", "services", "volumes"].includes(key)) ||
      Object.keys(base.volumes ?? {}).some((name) => name !== "pgdata") || Object.keys(base.volumes?.pgdata ?? {}).length) throw new Error("恢复部署隔离不支持额外运行资源");
    const allowed = ["image", "ports", "expose", "environment", "restart", "depends_on", "labels", "volumes"];
    for (const item of catalog) {
      const service = base.services[item.service];
      if (Object.keys(service).some((key) => !allowed.includes(key)) || service.volumes?.length ||
        (item.service !== "gateway" && service.ports?.length) || (service.environment && (typeof service.environment !== "object" || Array.isArray(service.environment)))) throw new Error("恢复部署隔离不支持宿主资源、命令覆盖或额外入口");
    }
  }
  const result = structuredClone(base); delete result.name;
  for (const item of release.images) result.services[item.service].image = item.reference;
  result.services.gateway.ports = [config.gatewayBind + ":" + config.gatewayPort + ":" + catalog.find((item) => item.service === "gateway").port];
  if (config.schema === "magictools-deployment-config/2") {
    delete result.services.postgres;
    // 早期已发布制品使用这一固定默认连接；只在派生配置中改为显式私有env引用。
    for (const item of recoveryConnectionFields(catalog)) {
      const environment = result.services[item.service]?.environment;
      if (environment?.[item.field] === "postgres://postgres:postgres@postgres:5432/" + item.database) environment[item.field] = "${" + item.variable + ":?" + item.variable + " is required}";
    }
    if (result.volumes) { delete result.volumes.pgdata; if (!Object.keys(result.volumes).length) delete result.volumes; }
    result.networks = { default: { internal: true }, restored: { external: true, name: config.database.network.name },
      ingress: { internal: false, labels: { "magictools.recovery.network": "ingress" } } };
    for (const item of catalog) {
      const service = result.services[item.service];
      service.networks = item.app === "gateway" ? ["default", "ingress"] : item.kind === "node" ? ["default", "restored"] : ["default"];
      if (service.depends_on) {
        if (Array.isArray(service.depends_on)) service.depends_on = service.depends_on.filter((name) => name !== "postgres");
        else delete service.depends_on.postgres;
        if (!Object.keys(service.depends_on).length) delete service.depends_on;
      }
    }
  }
  return result;
}
