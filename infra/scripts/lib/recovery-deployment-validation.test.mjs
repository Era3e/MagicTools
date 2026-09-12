import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { runtimeCatalog } from "./runtime-artifacts.mjs";
import { digestBytes } from "./release-artifacts.mjs";
import { inspectRecoveryValidationReleases, parseRecoveryValidationArgs, RecoveryValidationResources } from "./recovery-deployment-validation.mjs";

test("正式恢复验收要求两个显式目录，不接受保留失败资源或未知参数", () => {
  assert.deepEqual(parseRecoveryValidationArgs(["--previous", "release A", "--current", "release B"]), { previousDirectory: "release A", currentDirectory: "release B" });
  for (const args of [[], ["--previous", "A"], ["--previous", "A", "--current", "B", "--keep-on-failure"], ["--previous", "A", "--previous", "B", "--current", "C"]]) assert.throws(() => parseRecoveryValidationArgs(args));
  assert.deepEqual(parseRecoveryValidationArgs(["--previous", "A", "--current", "A", "--config-change"]), { previousDirectory: "A", currentDirectory: "A", configChange: true });
  assert.throws(() => parseRecoveryValidationArgs(["--previous", "A", "--current", "A", "--allow-validation"]));
});

test("不存在的release目录在任何Docker操作之前明确失败", () => {
  assert.throws(() => inspectRecoveryValidationReleases("/missing-recovery-release-one", "/missing-recovery-release-two"), /制品目录/);
});

const scratchRoot = realpathSync(tmpdir());
function withReleases(action) {
  const directory = mkdtempSync(join(scratchRoot, "mt-recovery-validation-"));
  try {
    const ports = parse(readFileSync(new URL("../../ports.yaml", import.meta.url), "utf8"));
    const catalog = runtimeCatalog(ports);
    const folders = ["a", "b"].map((letter) => {
      const folder = join(directory, letter); mkdirSync(folder);
      const files = { "ports.json": JSON.stringify(ports), "compose.json": JSON.stringify(parse(readFileSync(new URL("../../compose.prod.yml", import.meta.url), "utf8"))), "postgres-init.sql": "SELECT 1;\n" };
      for (const [name, content] of Object.entries(files)) writeFileSync(join(folder, name), content);
      const revision = letter.repeat(40);
      const release = { schema: "magictools-release/1", success: true, mode: "release", releaseId: revision + "-fixture", revision, platform: "linux/amd64",
        source: { clean: true, checkoutSha: revision, fingerprint: "c".repeat(64) }, files: Object.entries(files).map(([path, content]) => ({ path, sha256: digestBytes(content) })),
        images: catalog.map(({ service }) => ({ service, repository: "localhost:55101/recovery/" + service, reference: "localhost:55101/recovery/" + service + "@sha256:" + "d".repeat(64),
          registryDigest: "sha256:" + "d".repeat(64), localImageId: "sha256:" + "e".repeat(64), revision, platform: "linux/amd64", healthcheck: true })) };
      writeFileSync(join(folder, "release.json"), JSON.stringify(release)); return folder;
    });
    return action(folders);
  } finally {
    const actual = resolve(directory); assert.equal(dirname(actual), scratchRoot); assert.ok(actual.startsWith(join(scratchRoot, "mt-recovery-validation-")));
    assert.equal(lstatSync(actual).isSymbolicLink(), false); assert.equal(realpathSync(actual), actual); rmSync(actual, { recursive: true });
  }
}

test("原始17应用固定制品可预检，外部registry和5432伪装registry均拒绝", () => withReleases(([a, b]) => {
  assert.equal(inspectRecoveryValidationReleases(a, b).catalog.length, 17);
  const file = join(b, "release.json"), original = JSON.parse(readFileSync(file, "utf8"));
  for (const host of ["registry.example.com", "localhost:5432"]) {
    const bad = structuredClone(original);
    for (const image of bad.images) { image.repository = host + "/recovery/" + image.service; image.reference = image.repository + "@" + image.registryDigest; }
    writeFileSync(file, JSON.stringify(bad));
    assert.throws(() => inspectRecoveryValidationReleases(a, b), /本机.*registry/);
  }
}));

test("错误摘要、相同revision或validation输入不能冒充两版正式制品", () => withReleases(([a, b]) => {
  const file = join(b, "release.json"), original = readFileSync(file);
  assert.throws(() => inspectRecoveryValidationReleases(a, a), /不同源码/);
  const value = JSON.parse(original); value.mode = "validation"; writeFileSync(file, JSON.stringify(value));
  assert.throws(() => inspectRecoveryValidationReleases(a, b), /验证制品/);
  writeFileSync(file, original); writeFileSync(join(b, "postgres-init.sql"), "SELECT 2;\n");
  assert.throws(() => inspectRecoveryValidationReleases(a, b), /摘要/);
}));

test("清理仅删除记录的ID与归属，拒绝同名替换和foreign标签", () => {
  const values = new Map(), calls = [];
  const docker = (args) => {
    calls.push(args);
    if (args[1] === "inspect") { const item = [...values.values()].find((value) => value.Id === args[2] || value.Name === args[2]); if (!item) throw new Error("missing"); return JSON.stringify([item]); }
    if (args[1] === "ls") return [...values.values()].map((value) => value.Id).join("\n");
    if (args[0] === "rm") { const value = [...values.values()].find((entry) => entry.Id === args.at(-1)); values.delete(value.Name); return value.Id; }
    throw new Error("unexpected");
  };
  values.set("owned", { Name: "owned", Id: "a".repeat(64), Config: { Labels: { validation: "mine" } } });
  const tracker = new RecoveryValidationResources(docker); tracker.remember("container", "owned", { validation: "mine" });
  values.get("owned").Config.Labels.validation = "foreign";
  assert.equal(tracker.cleanup().length, 1); assert.equal(calls.some((args) => args[0] === "rm"), false);
  values.get("owned").Config.Labels.validation = "mine";
  assert.deepEqual(tracker.cleanup(), []); assert.equal(values.size, 0);
});

test("CI同制品配置变更与validation输入均需各自显式授权且保留真实mode", () => withReleases(([a]) => {
  assert.equal(inspectRecoveryValidationReleases(a, a, { configChange: true }).releaseComparison, "config-change");
  const file = join(a, "release.json"), release = JSON.parse(readFileSync(file, "utf8")); release.mode = "validation"; writeFileSync(file, JSON.stringify(release));
  assert.throws(() => inspectRecoveryValidationReleases(a, a, { configChange: true }), /验证制品/);
  assert.throws(() => inspectRecoveryValidationReleases(a, a, { allowValidation: true }), /不同源码/);
  const validated = inspectRecoveryValidationReleases(a, a, { configChange: true, allowValidation: true });
  assert.equal(validated.releaseComparison, "config-change"); assert.equal(validated.current.release.mode, "validation");
  assert.throws(() => inspectRecoveryValidationReleases(a, a, { configChange: "true", allowValidation: true }), /布尔/);
}));

test("创建时间变化的同名卷不能被清理，Docker不可用不能误判已清理", () => {
  let volume = { Name: "owned-data", CreatedAt: "2026-09-12T00:00:00Z", Labels: { validation: "mine" } }, removed = false;
  const docker = (args) => { if (args[1] === "inspect") return JSON.stringify([volume]); if (args[1] === "rm") { removed = true; return ""; } throw new Error("unavailable"); };
  const tracker = new RecoveryValidationResources(docker); tracker.remember("volume", volume.Name, { validation: "mine" });
  volume = { ...volume, CreatedAt: "2026-09-12T01:00:00Z" };
  assert.equal(tracker.cleanup().length, 1); assert.equal(removed, false);
  tracker.docker = () => { throw new Error("unavailable"); };
  assert.equal(tracker.cleanup().length, 1);
});

test("不存在的专用故障image按image的Repository:Tag清单确认缺失", () => {
  const calls = [];
  const tracker = new RecoveryValidationResources((args) => { calls.push(args); if (args[1] === "inspect") throw new Error("missing"); return ""; });
  assert.equal(tracker.optional("image", "localhost:5000/test/manager-server:failure"), null);
  assert.ok(calls.some((args) => args.includes("{{.Repository}}:{{.Tag}}")));
});

test("containerd把本轮已发布digest也放入RepoTags时仍可清理同一故障镜像", () => {
  const tag = "localhost:5000/recovery-123/manager-server:failure", reference = "localhost:5000/recovery-123/manager-server@sha256:" + "a".repeat(64);
  const labels = { validation: "mine" }, image = { Id: "sha256:" + "b".repeat(64), Config: { Labels: labels }, RepoTags: [tag, reference], RepoDigests: [reference] };
  const commands = [], docker = (args) => { commands.push(args); if (args[1] === "inspect") return JSON.stringify([image]); if (args[1] === "ls" || args[1] === "rm") return ""; throw new Error("unexpected command"); };
  const tracker = new RecoveryValidationResources(docker); const owned = tracker.remember("image", tag, labels, { tag, reference });
  assert.deepEqual(tracker.cleanup(), []); assert.ok(commands.some((args) => args[0] === "image" && args[1] === "rm" && args.at(-1) === image.Id));
  for (const extra of ["localhost:5000/other/manager-server@sha256:" + "a".repeat(64), "localhost:5000/recovery-123/manager-server:keep", "localhost:5000/recovery-123/manager-server@sha256:" + "c".repeat(64)]) {
    commands.length = 0; image.RepoTags = [tag, reference, extra]; image.RepoDigests = [reference, extra];
    assert.equal(tracker.cleanup().length, 1); assert.ok(!commands.some((args) => args[1] === "rm"));
  }
  image.RepoTags = [tag, reference]; image.RepoDigests = []; commands.length = 0;
  assert.equal(tracker.cleanup().length, 1); assert.ok(!commands.some((args) => args[1] === "rm"));
  for (const extra of ["localhost:5000/other/manager-server@sha256:" + "a".repeat(64), "localhost:5000/recovery-123/manager-server@sha256:" + "c".repeat(64)]) {
    image.RepoDigests = [reference, extra]; commands.length = 0;
    assert.equal(tracker.cleanup().length, 1); assert.ok(!commands.some((args) => args[1] === "rm"));
  }
  image.RepoDigests = [reference]; owned.reference = "localhost:5000/other/manager-server@sha256:" + "a".repeat(64); image.RepoTags = [tag, owned.reference]; image.RepoDigests = [owned.reference];
  assert.equal(tracker.cleanup().length, 1);
});

test("current源平台必须使用私有env数据库配置，previous旧字面配置仍可恢复部署", () => withReleases(([a, b]) => {
  const legacy = (directory, passwordOnly = false) => {
    const file = join(directory, "compose.json"), compose = JSON.parse(readFileSync(file, "utf8"));
    compose.services.postgres.environment.POSTGRES_PASSWORD = "postgres";
    if (!passwordOnly) for (const [name, service] of Object.entries(compose.services)) for (const key of Object.keys(service.environment ?? {})) {
      if (!key.endsWith("DATABASE_URL")) continue;
      const database = key === "DATABASE_URL" ? name.slice(0, -7) : key.slice(0, -13).toLowerCase();
      service.environment[key] = "postgres://postgres:postgres@postgres:5432/" + database;
    }
    const content = JSON.stringify(compose); writeFileSync(file, content);
    const manifest = join(directory, "release.json"), release = JSON.parse(readFileSync(manifest, "utf8"));
    release.files.find((entry) => entry.path === "compose.json").sha256 = digestBytes(content); writeFileSync(manifest, JSON.stringify(release));
  };
  legacy(a); assert.equal(inspectRecoveryValidationReleases(a, b).catalog.length, 17);
  legacy(b, true); assert.throws(() => inspectRecoveryValidationReleases(a, b), /current.*私有env/);
}));
