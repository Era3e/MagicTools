import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import childProcess from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { syncBuiltinESMExports } from "node:module";
import { parse } from "yaml";
import { deployRelease } from "../deploy-release.mjs";
import { digestBytes } from "./release-artifacts.mjs";
import { runtimeCatalog } from "./runtime-artifacts.mjs";
import { deploymentSucceeded, validateDeploymentState } from "./deployment-state.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const work = join(dirname(root), "deployment-review-fixtures");
fs.mkdirSync(work, { recursive: true });

function writeRelease(input, revision = "a".repeat(40)) {
  const release = { schema: "magictools-release/1", success: true, mode: "release",
    releaseId: revision + "-1234567890abcdef", revision, platform: "linux/amd64",
    source: { clean: true, checkoutSha: revision, fingerprint: digestBytes(revision) },
    files: Object.entries(input.files).map(([path, bytes]) => ({ path, sha256: digestBytes(bytes) })),
    images: input.catalog.map((item) => {
      const repository = "registry.example.invalid/review/" + item.service;
      const registryDigest = "sha256:" + digestBytes(revision + item.service);
      return { service: item.service, repository, registryDigest, reference: repository + "@" + registryDigest,
        localImageId: "sha256:" + digestBytes("local:" + revision + item.service), revision, platform: "linux/amd64", healthcheck: true };
    }) };
  fs.writeFileSync(join(input.releaseDirectory, "release.json"), JSON.stringify(release));
  input.release = release;
  return release;
}

function fixture() {
  const directory = fs.mkdtempSync(join(work, "review-"));
  const releaseDirectory = join(directory, "release"); fs.mkdirSync(releaseDirectory);
  const ports = parse(fs.readFileSync(join(root, "infra/ports.yaml"), "utf8"));
  const catalog = runtimeCatalog(ports);
  const compose = { services: Object.fromEntries(catalog.map((item) => [item.service, { image: "unset" }])), volumes: { pgdata: {} } };
  compose.services.gateway.environment = { GATEWAY_TOKEN: "${GATEWAY_TOKEN:-}" };
  compose.services.postgres = { image: "pgvector/pgvector:pg16@sha256:" + "b".repeat(64),
    volumes: ["pgdata:/var/lib/postgresql/data", "./postgres-init.sql:/docker-entrypoint-initdb.d/init.sql:ro"] };
  const files = { "ports.json": JSON.stringify(ports), "compose.json": JSON.stringify(compose), "postgres-init.sql": "SELECT 1;\n" };
  for (const [name, bytes] of Object.entries(files)) fs.writeFileSync(join(releaseDirectory, name), bytes);
  const configFile = join(directory, "config.json");
  fs.writeFileSync(configFile, JSON.stringify({ schema: "magictools-deployment-config/1", project: "mt-validation-review-" + randomBytes(4).toString("hex"),
    gatewayBind: "127.0.0.1", gatewayPort: 53199, waitTimeoutSeconds: 30 }));
  const secretsFile = join(directory, "existing.env");
  fs.writeFileSync(secretsFile, "GATEWAY_TOKEN=independent-original-secret\n");
  const input = { directory, releaseDirectory, configFile, secretsFile, stateDirectory: join(directory, "state"), ports, catalog, compose, files };
  writeRelease(input);
  return input;
}

const ready = ({ release }) => release.images.map((item) => ({ service: item.service, reference: item.reference,
  localImageId: item.localImageId, platform: item.platform, healthy: true }));
const success = { executeCompose: async () => {}, verifyDeployment: async (context) => ready(context) };
const state = (input) => JSON.parse(fs.readFileSync(join(input.stateDirectory, "state.json"), "utf8"));
const receipts = (input) => fs.readdirSync(join(input.stateDirectory, "attempts"))
  .map((id) => JSON.parse(fs.readFileSync(join(input.stateDirectory, "attempts", id, "receipt.json"), "utf8")));
const pointer = (id, checksum) => ({ attemptId: id.repeat(16), releaseId: "release-a", manifestSha256: checksum.repeat(64), configVersion: "c".repeat(64) });

test("独立验收：成功状态指针必须包含合法制品校验和", () => {
  const original = deploymentSucceeded(null, pointer("1", "a"));
  for (const manifestSha256 of [undefined, "", "invalid", "f".repeat(63)]) {
    const altered = structuredClone(original); altered.current.manifestSha256 = manifestSha256;
    assert.throws(() => validateDeploymentState(altered));
  }
});

test("独立验收：同名制品内容变化不能作为无变化重部署丢失前一快照", () => {
  const first = pointer("1", "a");
  const next = pointer("2", "b");
  const updated = deploymentSucceeded(deploymentSucceeded(null, first), next);
  assert.equal(updated.previous?.attemptId, first.attemptId);
  assert.equal(updated.previous?.manifestSha256, first.manifestSha256);
});

test("独立验收：就绪验证未完成时没有成功状态，同目录并发部署被锁拒绝", async () => {
  const input = fixture();
  let enter; let release;
  const entered = new Promise((resolve) => { enter = resolve; });
  const held = new Promise((resolve) => { release = resolve; });
  const first = deployRelease(input, { ...success, verifyDeployment: async (context) => { enter(); await held; return ready(context); } });
  try {
    await entered;
    assert.equal(fs.existsSync(join(input.stateDirectory, "state.json")), false);
    assert.equal(fs.existsSync(join(input.stateDirectory, "deploy.lock")), true);
    await assert.rejects(deployRelease(input, success), /锁/);
  } finally { release(); }
  const result = await first;
  assert.equal(result.success, true);
  assert.equal(state(input).current.attemptId, result.attemptId);
  assert.equal(fs.existsSync(join(input.stateDirectory, "deploy.lock")), false);
});

test("独立验收：秘密文件不被环境覆盖或恢复旧值，变更时保留旧成功指针", async () => {
  const input = fixture(); const before = fs.readFileSync(input.secretsFile);
  const ambient = process.env.GATEWAY_TOKEN; process.env.GATEWAY_TOKEN = "ambient-review-secret";
  let first;
  try {
    first = await deployRelease(input, { ...success, executeCompose: async ({ env }) => { assert.equal(env.GATEWAY_TOKEN, undefined); } });
  } finally { if (ambient === undefined) delete process.env.GATEWAY_TOKEN; else process.env.GATEWAY_TOKEN = ambient; }
  assert.deepEqual(fs.readFileSync(input.secretsFile), before);
  const rotated = "GATEWAY_TOKEN=independent-rotated-secret\n";
  await assert.rejects(deployRelease(input, { ...success, executeCompose: async ({ command }) => {
    if (command[0] === "pull") fs.writeFileSync(input.secretsFile, rotated);
  } }), /秘密文件发生变化/);
  assert.equal(fs.readFileSync(input.secretsFile, "utf8"), rotated);
  assert.equal(state(input).current.attemptId, first.attemptId);
  assert.equal(state(input).lastAttempt.status, "failed");
  assert.equal(JSON.stringify(receipts(input)).includes("independent-rotated-secret"), false);
  assert.equal(JSON.stringify(receipts(input)).includes("independent-original-secret"), false);
});

test("独立验收：回退使用保存的制品与配置快照，快照损坏时不操作Docker", async () => {
  const input = fixture(); const a = await deployRelease(input, success);
  writeRelease(input, "b".repeat(40));
  const b = await deployRelease(input, success);
  fs.writeFileSync(join(input.releaseDirectory, "release.json"), "broken external copy");
  fs.writeFileSync(input.configFile, "broken external config");
  const restored = await deployRelease({ stateDirectory: input.stateDirectory, secretsFile: input.secretsFile, rollback: true }, success);
  assert.equal(restored.releaseId, a.releaseId); assert.equal(restored.configVersion, a.configVersion);
  assert.equal(state(input).previous.attemptId, b.attemptId);
  fs.writeFileSync(join(input.stateDirectory, "attempts", b.attemptId, "bundle", "postgres-init.sql"), "changed snapshot");
  let called = false;
  await assert.rejects(deployRelease({ stateDirectory: input.stateDirectory, secretsFile: input.secretsFile, rollback: true },
    { ...success, executeCompose: async () => { called = true; } }), /校验/);
  assert.equal(called, false);
  assert.equal(state(input).current.attemptId, restored.attemptId);
});

test("独立验收：回执原子落盘失败不能推进成功状态指针", async () => {
  const input = fixture(); const first = await deployRelease(input, success);
  writeRelease(input, "b".repeat(40));
  const rename = fs.renameSync;
  fs.renameSync = function (from, to) {
    if (String(to).endsWith("receipt.json")) throw Object.assign(new Error("review receipt write failed"), { code: "EIO" });
    return rename.call(fs, from, to);
  };
  syncBuiltinESMExports();
  try { await assert.rejects(deployRelease(input, success), /review receipt write failed/); }
  finally { fs.renameSync = rename; syncBuiltinESMExports(); }
  assert.equal(state(input).current.attemptId, first.attemptId);
});

test("独立验收：部署锁持续持有到回执原子落盘完成", async () => {
  const input = fixture(); const rename = fs.renameSync; const lockStates = [];
  fs.renameSync = function (from, to) {
    if (String(to).endsWith("receipt.json")) lockStates.push(fs.existsSync(join(input.stateDirectory, "deploy.lock")));
    return rename.call(fs, from, to);
  };
  syncBuiltinESMExports();
  try { await deployRelease(input, success); }
  finally { fs.renameSync = rename; syncBuiltinESMExports(); }
  assert.ok(lockStates.length > 0);
  assert.ok(lockStates.every(Boolean), "回执提交前不应释放部署锁");
});

test("独立验收：损坏的制品或状态不触发部署，也不改写原有坏状态", async () => {
  const input = fixture(); const first = await deployRelease(input, success);
  fs.writeFileSync(join(input.releaseDirectory, "ports.json"), "{}");
  let called = false;
  await assert.rejects(deployRelease(input, { ...success, executeCompose: async () => { called = true; } }));
  assert.equal(called, false); assert.equal(state(input).current.attemptId, first.attemptId);
  const corrupted = "{invalid state"; fs.writeFileSync(join(input.stateDirectory, "state.json"), corrupted);
  await assert.rejects(deployRelease(input, { ...success, executeCompose: async () => { called = true; } }));
  assert.equal(fs.readFileSync(join(input.stateDirectory, "state.json"), "utf8"), corrupted);
  assert.equal(called, false);
});

test("独立验收：相同初始化SQL重部署复用挂载路径，SQL更新按内容隔离", async () => {
  const input = fixture(); const mounts = [];
  const dependencies = { ...success, executeCompose: async ({ command, composeArgs }) => {
    if (command[0] !== "config") return;
    const rendered = JSON.parse(fs.readFileSync(composeArgs[composeArgs.indexOf("-f") + 1], "utf8"));
    mounts.push(rendered.services.postgres.volumes.find((volume) => volume.target === "/docker-entrypoint-initdb.d/init.sql"));
  } };
  await deployRelease(input, dependencies);
  writeRelease(input, "b".repeat(40));
  await deployRelease(input, dependencies);
  input.files["postgres-init.sql"] = "SELECT 2;\n";
  fs.writeFileSync(join(input.releaseDirectory, "postgres-init.sql"), input.files["postgres-init.sql"]);
  writeRelease(input, "c".repeat(40));
  await deployRelease(input, dependencies);
  assert.equal(mounts.length, 3);
  assert.deepEqual(mounts[0], mounts[1]);
  assert.notEqual(mounts[1].source, mounts[2].source);
  for (const mount of mounts) {
    const hash = digestBytes(fs.readFileSync(mount.source));
    assert.equal(mount.source, join(input.stateDirectory, "bootstrap", hash, "postgres-init.sql"));
    assert.equal(mount.read_only, true);
  }
});

test("独立验收：损坏的共享初始化SQL缓存必须在Docker执行前拒绝", async () => {
  const input = fixture(); const first = await deployRelease(input, success);
  const cached = join(input.stateDirectory, "bootstrap", digestBytes(input.files["postgres-init.sql"]), "postgres-init.sql");
  fs.writeFileSync(cached, "SELECT 'unexpected';\n");
  let invoked = false;
  await assert.rejects(deployRelease(input, { ...success, executeCompose: async () => { invoked = true; } }), /缓存校验失败/);
  assert.equal(invoked, false);
  assert.equal(state(input).current.attemptId, first.attemptId);
  assert.equal(state(input).lastAttempt.status, "failed");
});

test("独立验收：真实身份核验逻辑拒绝移动引用、错误镜像、平台、所有者及非健康状态", async () => {
  const input = fixture(); const owner = "independent-owner";
  const names = [...input.catalog.map((item) => item.service), "postgres"];
  const ids = new Map(names.map((name, index) => [name, (index + 1).toString(16).padStart(12, "0")]));
  let fault = "";
  const fake = () => {};
  fake[promisify.custom] = async (_command, args) => {
    let value;
    if (args[0] === "compose") value = args.includes("--all") ? [...ids.values()].join("\n") : ids.get(args.at(-1));
    else if (args[0] === "inspect") {
      const name = names.find((name) => ids.get(name) === args[1]);
      const target = input.release.images.find((item) => item.service === name);
      value = JSON.stringify({ image: fault === "image" && name === "gateway" ? "sha256:" + "f".repeat(64) : "sha256:" + digestBytes("pulled:" + name),
        reference: fault === "reference" && name === "gateway" ? "repo:latest" : target?.reference ?? input.compose.services.postgres.image,
        health: { Status: fault === "health" && name === "gateway" ? "unhealthy" : "healthy" },
        labels: { "magictools.deployment": fault === "owner" && name === "gateway" ? "other-owner" : owner } });
    } else if (args[0] === "image") {
      const target = input.release.images.find((item) => item.reference === args[2]);
      value = JSON.stringify({ id: "sha256:" + digestBytes("pulled:" + target.service),
        labels: { "org.opencontainers.image.revision": fault === "revision" ? "other" : input.release.revision },
        os: "linux", architecture: fault === "platform" ? "arm64" : "amd64" });
    } else throw new Error("Unexpected mocked Docker request");
    return { stdout: value, stderr: "" };
  };
  const original = childProcess.execFile;
  childProcess.execFile = fake; syncBuiltinESMExports();
  let module;
  try { module = await import(pathToFileURL(join(root, "infra/scripts/deploy-release.mjs")).href + "?review=" + randomBytes(6).toString("hex")); }
  finally { childProcess.execFile = original; syncBuiltinESMExports(); }
  const context = { composeArgs: ["compose", "--project-name", "independent-review"], env: {}, owner, release: input.release, catalog: input.catalog };
  assert.equal((await module.verifyDeployment(context)).length, 17);
  for (const next of ["reference", "image", "revision", "platform", "owner", "health"]) {
    fault = next; await assert.rejects(module.verifyDeployment(context), next);
  }
});
