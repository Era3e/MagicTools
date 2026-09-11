import { createHash } from "node:crypto";
import { isRegistryNamespace, validateBuildManifest } from "./runtime-artifacts.mjs";

export const digestBytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const releaseFiles = ["compose.json", "postgres-init.sql", "ports.json"];

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
  const keys = ["schema", "project", "gatewayBind", "gatewayPort", "waitTimeoutSeconds"];
  if (!config || Object.keys(config).some((key) => !keys.includes(key)) || config.schema !== "magictools-deployment-config/1") throw new Error("部署公开配置无效，秘密应使用独立 env 文件");
  if (typeof config.project !== "string" || !/^[a-z][a-z0-9-]{2,48}$/.test(config.project)) throw new Error("部署项目名非法");
  if (!["127.0.0.1", "0.0.0.0"].includes(config.gatewayBind)) throw new Error("网关绑定地址必须显式选择本机或全部接口");
  if (!Number.isInteger(config.gatewayPort) || config.gatewayPort < 1 || config.gatewayPort > 65535) throw new Error("网关端口非法");
  if (!Number.isInteger(config.waitTimeoutSeconds) || config.waitTimeoutSeconds < 30 || config.waitTimeoutSeconds > 900) throw new Error("就绪等待须为30至900秒");
  const canonical = Object.fromEntries(keys.map((key) => [key, config[key]]));
  return { config: canonical, configVersion: digestBytes(JSON.stringify(canonical)) };
}

export function renderReleaseCompose(base, release, catalog, config) {
  validateDeploymentConfig(config);
  const expected = new Set(["postgres", ...catalog.map((item) => item.service)]);
  if (!base.services || Object.keys(base.services).length !== expected.size || Object.keys(base.services).some((key) => !expected.has(key))) throw new Error("发布 Compose 与服务清单不一致");
  const result = structuredClone(base); delete result.name;
  for (const item of release.images) result.services[item.service].image = item.reference;
  result.services.gateway.ports = [config.gatewayBind + ":" + config.gatewayPort + ":" + catalog.find((item) => item.service === "gateway").port];
  return result;
}
