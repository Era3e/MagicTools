import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { runtimeCatalog, validateBuildManifest } from "./runtime-artifacts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
test("制品清单覆盖网关与八组前后端，不接受重复端口", () => {
  const ports = parse(readFileSync(root + "/infra/ports.yaml", "utf8"));
  const catalog = runtimeCatalog(ports);
  assert.equal(catalog.length, 17);
  assert.equal(new Set(catalog.map((item) => item.service)).size, 17);
  assert.equal(catalog.find((item) => item.service === "manager-server").readinessPath, "/api/manager/health/ready");
  assert.throws(() => runtimeCatalog({ gateway: { web: 3000 }, broken: { web: 3000, server: 5001 } }), /端口/);
});

test("构建清单拒绝漏服务、错误源码标签和未配置就绪的镜像", () => {
  const catalog = runtimeCatalog(parse(readFileSync(root + "/infra/ports.yaml", "utf8")));
  const source = { clean: true, checkoutSha: "a".repeat(40), fingerprint: "b".repeat(64) };
  const manifest = { schema: "magictools-image-build/1", success: true, mode: "release", source, revision: source.checkoutSha, platform: "linux/amd64",
    images: catalog.map((item) => ({ service: item.service, reference: "test/" + item.service + ":" + source.checkoutSha,
      localImageId: "sha256:" + "c".repeat(64), revision: source.checkoutSha, platform: "linux/amd64", healthcheck: true })) };
  assert.doesNotThrow(() => validateBuildManifest(manifest, catalog));
  assert.throws(() => validateBuildManifest({ ...manifest, images: manifest.images.slice(1) }, catalog));
  const wrong = structuredClone(manifest); wrong.images[0].revision = "wrong";
  assert.throws(() => validateBuildManifest(wrong, catalog));
  const unhealthy = structuredClone(manifest); unhealthy.images[0].healthcheck = false;
  assert.throws(() => validateBuildManifest(unhealthy, catalog));
  assert.throws(() => validateBuildManifest({ ...manifest, source: { ...source, clean: false } }, catalog));
});
