import test from "node:test";
import assert from "node:assert/strict";
import { validateReleaseManifest, validateDeploymentConfig, renderReleaseCompose } from "./release-artifacts.mjs";

const services = [{ service: "gateway", app: "gateway", kind: "node", port: 3000 },
  { service: "manager-server", app: "manager", kind: "node", port: 5004 },
  { service: "manager-web", app: "manager", kind: "web", port: 4004 }];
const sha = "a".repeat(40);
const config = { schema: "magictools-deployment-config/1", project: "mt-validation-release", gatewayBind: "127.0.0.1", gatewayPort: 53200, waitTimeoutSeconds: 120 };
const complete = () => ({ schema: "magictools-release/1", success: true, mode: "release", releaseId: sha + "-1234567890abcdef", revision: sha, platform: "linux/amd64",
  source: { clean: true, checkoutSha: sha, fingerprint: "b".repeat(64) },
  files: ["compose.json", "postgres-init.sql", "ports.json"].map((path) => ({ path, sha256: "c".repeat(64) })),
  images: services.map((service) => ({ service: service.service, repository: "localhost:55101/magictools/" + service.service,
    reference: "localhost:55101/magictools/" + service.service + "@sha256:" + "d".repeat(64), registryDigest: "sha256:" + "d".repeat(64),
    localImageId: "sha256:" + "e".repeat(64), revision: sha, platform: "linux/amd64", healthcheck: true })) });

test("发布清单必须完整绑定源码、平台和registry digest，不能用移动标签或部分服务替代", () => {
  assert.doesNotThrow(() => validateReleaseManifest(complete(), services));
  for (const change of [
    (release) => { release.images[0].reference = release.images[0].repository + ":latest"; },
    (release) => { release.images.pop(); },
    (release) => { release.images[0].registryDigest = "sha256:" + "f".repeat(64); },
    (release) => { release.source.clean = false; },
    (release) => { release.images[0].platform = "linux/arm64"; },
    (release) => { release.files.pop(); },
    (release) => { release.files[0].path = "../../outside"; },
    (release) => { release.success = false; },
  ]) { const release = complete(); change(release); assert.throws(() => validateReleaseManifest(release, services)); }
});

test("工作树验证制品必须显式选择验证模式，不能部署为正式发布", () => {
  const release = complete(); release.mode = "validation";
  release.source.clean = false; release.revision = "worktree-" + release.source.fingerprint;
  release.releaseId = release.revision + "-1234567890abcdef";
  for (const image of release.images) image.revision = release.revision;
  assert.throws(() => validateReleaseManifest(release, services));
  assert.doesNotThrow(() => validateReleaseManifest(release, services, { allowValidation: true }));
});

test("公开部署配置有稳定版本且拒绝秘密、非法端口与命名空间", () => {
  const first = validateDeploymentConfig(config);
  assert.match(first.configVersion, /^[a-f0-9]{64}$/);
  assert.equal(validateDeploymentConfig({ ...config }).configVersion, first.configVersion);
  assert.notEqual(validateDeploymentConfig({ ...config, gatewayPort: 53201 }).configVersion, first.configVersion);
  for (const changed of [{ ...config, GATEWAY_TOKEN: "secret" }, { ...config, project: "../prod" }, { ...config, gatewayPort: 0 }, { ...config, gatewayBind: "evil;command" }]) {
    assert.throws(() => validateDeploymentConfig(changed));
  }
});

test("部署直接使用固定digest，保留秘密插值且不依赖旧IMAGE_TAG", () => {
  const base = { services: { gateway: { image: "${GATEWAY_IMAGE}", environment: { GATEWAY_TOKEN: "${GATEWAY_TOKEN}" } },
    "manager-server": { image: "${MANAGER_SERVER_IMAGE}" }, "manager-web": { image: "${MANAGER_WEB_IMAGE}" }, postgres: { image: "pgvector/pgvector@sha256:" + "f".repeat(64) } } };
  const snapshot = structuredClone(base); const release = complete();
  const rendered = renderReleaseCompose(base, release, services, config);
  assert.deepEqual(base, snapshot);
  assert.equal(rendered.services.gateway.image, release.images[0].reference);
  assert.deepEqual(rendered.services.gateway.ports, ["127.0.0.1:53200:3000"]);
  assert.equal(rendered.services.gateway.environment.GATEWAY_TOKEN, "${GATEWAY_TOKEN}");
  assert.equal(JSON.stringify(rendered).includes(":latest"), false);
});
