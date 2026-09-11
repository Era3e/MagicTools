import test from "node:test";
import assert from "node:assert/strict";
import { validateRuntimeEvidence, RUNTIME_CHECKS } from "./runtime-validation.mjs";

const catalog = [{ service: "gateway" }, { service: "manager-server" }];
const source = { clean: true, checkoutSha: "a".repeat(40), fingerprint: "b".repeat(64) };
const build = { schema: "magictools-image-build/1", success: true, mode: "release", source, revision: source.checkoutSha, platform: "linux/amd64",
  images: catalog.map((item, index) => ({ service: item.service, reference: "local/" + item.service + ":" + source.checkoutSha,
    localImageId: "sha256:" + index.toString(16).padStart(64, "0"), revision: source.checkoutSha, platform: "linux/amd64", healthcheck: true })) };
const fixture = () => ({ schema: "magictools-runtime-evidence/1", success: true, cleanup: "passed", source: structuredClone(source), revision: build.revision,
  mode: { database: "real", containers: "real", external: "not-invoked", liveModel: "not-run" },
  checks: RUNTIME_CHECKS.map((name) => ({ name, status: "passed" })), images: build.images.map(({ service, localImageId }) => ({ service, localImageId })) });

test("发布须使用通过完整运行检查的同一批镜像，匹配源码不足以替代镜像身份", () => {
  assert.doesNotThrow(() => validateRuntimeEvidence(fixture(), build, catalog));
  for (const change of [
    (report) => { report.images[0].localImageId = "sha256:" + "f".repeat(64); },
    (report) => { report.images[1] = { ...report.images[0] }; },
    (report) => { report.checks.pop(); },
    (report) => { report.checks[0].status = "failed"; },
    (report) => { report.success = false; },
    (report) => { report.cleanup = "failed"; },
    (report) => { report.source.fingerprint = "f".repeat(64); },
    (report) => { report.mode.containers = "mock"; },
  ]) { const report = fixture(); change(report); assert.throws(() => validateRuntimeEvidence(report, build, catalog)); }
});
