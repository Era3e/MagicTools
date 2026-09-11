import { validateBuildManifest } from "./runtime-artifacts.mjs";

export const RUNTIME_CHECKS = ["cold-start-17-services", "isolated-images-and-nonroot-node", "eight-databases-and-migrations",
  "assistant-probes-container-services", "web-deep-links-and-assets", "manager-create-and-update", "designer-builds-real-preview",
  "database-outage-and-recovery", "persistent-volume-after-recreation"];

export function validateRuntimeEvidence(report, build, catalog) {
  validateBuildManifest(build, catalog);
  if (report?.schema !== "magictools-runtime-evidence/1" || report.success !== true || report.cleanup !== "passed") throw new Error("运行验收或资源清理未成功");
  if (report.source?.checkoutSha !== build.source.checkoutSha || report.source?.fingerprint !== build.source.fingerprint || report.revision !== build.revision) throw new Error("运行验收源码与待发布构建不一致");
  if (report.mode?.database !== "real" || report.mode?.containers !== "real" || report.mode?.external !== "not-invoked" || report.mode?.liveModel !== "not-run") throw new Error("运行验收模式无效");
  if (report.checks?.length !== RUNTIME_CHECKS.length || RUNTIME_CHECKS.some((name, index) => report.checks[index]?.name !== name || report.checks[index]?.status !== "passed")) throw new Error("运行验收检查缺失或未通过");
  if (report.images?.length !== build.images.length || build.images.some((image) => report.images.find((actual) => actual.service === image.service)?.localImageId !== image.localImageId)) throw new Error("待发布镜像不是已通过运行验收的完整制品");
  return report;
}

export function makeValidationCompose(base, catalog, images, runId) {
  if (!/^[a-z0-9-]+$/.test(runId)) throw new Error("验证标识非法");
  if (Object.keys(base).some((key) => !["name", "services", "volumes"].includes(key))) throw new Error("验证配置禁止引用外部网络、秘密或配置");
  const expected = new Set(["postgres", ...catalog.map((item) => item.service)]);
  if (Object.keys(base.services ?? {}).length !== expected.size || Object.keys(base.services).some((name) => !expected.has(name))) throw new Error("Compose 服务清单不一致");
  if (Object.keys(base.volumes ?? {}).length !== 1 || Object.keys(base.volumes.pgdata ?? {}).length) throw new Error("验证卷必须是项目独立的匿名配置卷");
  if (base.networks && Object.keys(base.networks).length) throw new Error("验证网络必须由独立项目创建");
  const result = structuredClone(base); delete result.name;
  result.volumes.pgdata = { labels: { "magictools.validation": runId } };
  result.networks = { default: { labels: { "magictools.validation": runId } } };
  const allowed = new Set(["image", "ports", "expose", "environment", "restart", "depends_on", "volumes", "healthcheck", "labels"]);
  for (const [name, service] of Object.entries(result.services)) {
    if (Object.keys(service).some((key) => !allowed.has(key))) throw new Error("验证配置不能引用外部运行资源或覆盖镜像命令");
    if (service.environment && (Array.isArray(service.environment) || typeof service.environment !== "object")) throw new Error("验证环境必须使用显式变量映射");
    service.restart = "no";
    service.labels = { "magictools.validation": runId };
    delete service.ports;
    if (name === "postgres") {
      const expectedVolumes = ["pgdata:/var/lib/postgresql/data", "./postgres-init.sql:/docker-entrypoint-initdb.d/init.sql:ro"];
      if (JSON.stringify(service.volumes) !== JSON.stringify(expectedVolumes)) throw new Error("数据库挂载不符合独立验证契约");
      service.environment = { POSTGRES_PASSWORD: "postgres", POSTGRES_DB: "magictools" };
      continue;
    }
    if (service.volumes?.length) throw new Error("应用验证禁止挂载宿主源码或依赖");
    const image = images.find((item) => item.service === name);
    if (!/^sha256:[a-f0-9]{64}$/.test(image?.localImageId)) throw new Error("缺少本次构建镜像：" + name);
    service.image = image.localImageId;
    for (const key of Object.keys(service.environment ?? {})) {
      // 验证环境不读取用户的 .env。所有业务数据库均在本次独立 PostgreSQL 中。
      if (key.endsWith("DATABASE_URL")) {
        const database = key === "DATABASE_URL" ? name.slice(0, -7) : key.slice(0, -13).toLowerCase();
        service.environment[key] = "postgres://postgres:postgres@postgres:5432/" + database;
      } else if (!["PORT", "MT_PROD"].includes(key)) service.environment[key] = "";
    }
    if (name === "gateway") service.ports = ["127.0.0.1::" + catalog.find((item) => item.service === name).port];
  }
  return result;
}
