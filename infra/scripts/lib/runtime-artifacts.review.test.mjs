import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { runtimeCatalog, validateBuildManifest } from "./runtime-artifacts.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const catalog = runtimeCatalog(parse(readFileSync(join(root, "infra/ports.yaml"), "utf8")));

function completeManifest(platform = "linux/amd64") {
  const checkoutSha = "a".repeat(40);
  const runId = "1".repeat(16);
  return {
    schema: "magictools-image-build/1", success: true, mode: "release", runId, platform,
    startedAt: "2026-09-12T00:00:00.000Z", finishedAt: "2026-09-12T00:01:00.000Z",
    source: { clean: true, checkoutSha, candidateSha: checkoutSha, baseSha: checkoutSha,
      fingerprint: "b".repeat(64), tree: "c".repeat(40), repository: "review/fixture", runId: "local", attempt: "1", validationId: runId },
    revision: checkoutSha,
    images: catalog.map((item, index) => ({ service: item.service,
      reference: "review-local/" + item.service + ":" + checkoutSha,
      localImageId: "sha256:" + index.toString(16).padStart(64, "0"),
      revision: checkoutSha, platform, healthcheck: true })),
  };
}

test("独立验收：完整17服务的单平台构建正例通过", () => {
  assert.equal(catalog.length, 17);
  assert.equal(new Set(catalog.map((item) => item.service)).size, 17);
  assert.doesNotThrow(() => validateBuildManifest(completeManifest(), catalog));
  assert.doesNotThrow(() => validateBuildManifest(completeManifest("linux/arm64"), catalog));
});

test("独立验收：allowPartial 只能用于验证清单，不能让 release 漏服务", () => {
  const manifest = completeManifest();
  manifest.images = manifest.images.slice(0, 1);
  assert.throws(() => validateBuildManifest(manifest, catalog, { allowPartial: true }), /发布|release|服务|完整/);
  manifest.mode = "validation";
  assert.doesNotThrow(() => validateBuildManifest(manifest, catalog, { allowPartial: true }));
});

test("独立验收：服务名必须绑定对应镜像引用，不能指向另一个服务同版本镜像", () => {
  for (const replacement of ["gateway", "unknown-service"]) {
    const manifest = completeManifest();
    manifest.images.find((item) => item.service === "manager-server").reference = "review-local/" + replacement + ":" + manifest.revision;
    assert.throws(() => validateBuildManifest(manifest, catalog), /服务|引用|镜像/);
  }
});

test("独立验收：实际镜像平台必须等于本次请求平台，不能接受混合或整体偏离", () => {
  const mixed = completeManifest();
  mixed.images[0].platform = "linux/arm64";
  assert.throws(() => validateBuildManifest(mixed, catalog), /平台|platform|镜像/);
  const wrong = completeManifest();
  for (const item of wrong.images) item.platform = "linux/arm64";
  assert.throws(() => validateBuildManifest(wrong, catalog), /平台|platform|镜像/);
});

test("独立验收：脏工作树只能形成指纹验证版，不能冒充提交发布", () => {
  const manifest = completeManifest();
  manifest.source.clean = false;
  manifest.mode = "validation";
  manifest.revision = "worktree-" + manifest.source.fingerprint;
  for (const item of manifest.images) {
    item.revision = manifest.revision;
    item.reference = "review-local/" + item.service + ":" + manifest.revision;
  }
  assert.doesNotThrow(() => validateBuildManifest(manifest, catalog));
  manifest.mode = "release";
  assert.throws(() => validateBuildManifest(manifest, catalog), /干净|源码|验证|发布/);
});

test("独立验收：失败、重复服务、缺服务及就绪契约缺失均拒绝", () => {
  for (const change of [
    (manifest) => { manifest.success = false; },
    (manifest) => { manifest.images.pop(); },
    (manifest) => { manifest.images[1] = { ...manifest.images[0] }; },
    (manifest) => { manifest.images[0].healthcheck = false; },
    (manifest) => { manifest.images[0].revision = "other-commit"; },
    (manifest) => { manifest.images[0].localImageId = "latest"; },
  ]) {
    const manifest = completeManifest();
    change(manifest);
    assert.throws(() => validateBuildManifest(manifest, catalog));
  }
});
