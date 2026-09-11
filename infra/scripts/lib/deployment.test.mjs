import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join, parse, resolve } from "node:path";
import { deploymentFixture as fixture } from "./deployment-fixture.mjs";
import { deployRelease, isPathInside } from "../deploy-release.mjs";

const success = { executeCompose: async () => {}, verifyDeployment: async ({ release }) => release.images.map((item) => ({ service: item.service, reference: item.reference, healthy: true })) };
const state = (input) => JSON.parse(readFileSync(join(input.stateDirectory, "state.json"), "utf8"));
const latest = (input) => {
  const root = join(input.stateDirectory, "attempts");
  return readdirSync(root).map((id) => JSON.parse(readFileSync(join(root, id, "receipt.json"), "utf8"))).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).at(-1);
};

test("秘密文件输出冲突检查覆盖文件系统根目录与普通子目录", () => {
  const root = parse(resolve(".")).root;
  assert.equal(isPathInside(root, join(root, "state.json")), true);
  assert.equal(isPathInside(join(root, "state"), join(root, "state", "existing.env")), true);
  assert.equal(isPathInside(join(root, "state"), join(root, "secrets", "existing.env")), false);
});

test("成功部署才更新成功指针，记录配置/制品和验证结果且保留已有秘密文件", async () => {
  const input = fixture(); const before = readFileSync(input.secretsFile); const commands = [];
  const result = await deployRelease(input, { ...success, executeCompose: async ({ command }) => { commands.push(command); } });
  assert.equal(result.success, true); assert.equal(result.ready.length, 3);
  assert.equal(state(input).current.attemptId, result.attemptId);
  assert.match(result.manifestSha256, /^[a-f0-9]{64}$/); assert.match(result.configVersion, /^[a-f0-9]{64}$/);
  assert.deepEqual(readFileSync(input.secretsFile), before);
  assert.deepEqual(commands.map((command) => command[0]), ["config", "pull", "up"]);
  assert.ok(commands[2].includes("--wait"));
  assert.equal(JSON.stringify(result).includes("unit-secret"), false);
});

test("拉取或就绪失败保留最后成功制品，写失败回执并拒绝报告成功", async () => {
  for (const stage of ["pull", "verify"]) {
    const input = fixture(); const first = await deployRelease(input, success); const bytes = readFileSync(input.secretsFile);
    await assert.rejects(deployRelease(input, {
      executeCompose: async ({ command }) => { if (stage === "pull" && command[0] === "pull") throw new Error("registry unavailable"); },
      verifyDeployment: async () => { throw new Error("readiness failed"); },
    }));
    assert.equal(state(input).current.attemptId, first.attemptId);
    assert.equal(state(input).lastAttempt.status, "failed");
    assert.equal(latest(input).success, false);
    assert.deepEqual(readFileSync(input.secretsFile), bytes);
  }
});

test("制品文件被改动时，在执行Docker前失败", async () => {
  const input = fixture(); writeFileSync(join(input.releaseDirectory, "postgres-init.sql"), "SELECT 'tampered';");
  let called = false;
  await assert.rejects(deployRelease(input, { ...success, executeCompose: async () => { called = true; } }), /校验/);
  assert.equal(called, false); assert.equal(latest(input).success, false);
});

test("缺少秘密文件或公开配置混入秘密均留下失败回执，不调用Docker", async () => {
  for (const kind of ["missing-secret", "public-secret"]) {
    const input = fixture(); let called = false;
    if (kind === "missing-secret") input.secretsFile = join(input.directory, "missing.env");
    else {
      const config = JSON.parse(readFileSync(input.configFile, "utf8")); config.GATEWAY_TOKEN = "must-not-be-recorded";
      writeFileSync(input.configFile, JSON.stringify(config));
    }
    await assert.rejects(deployRelease(input, { ...success, executeCompose: async () => { called = true; } }));
    assert.equal(called, false); assert.equal(latest(input).success, false);
    assert.equal(JSON.stringify(latest(input)).includes("must-not-be-recorded"), false);
  }
});

test("两次部署后从成功快照回退，失败后恢复最后成功版本，秘密文件不参与回退", async () => {
  const input = fixture(); const first = await deployRelease(input, success);
  const releaseFile = join(input.releaseDirectory, "release.json");
  const release = JSON.parse(readFileSync(releaseFile, "utf8"));
  release.revision = "b".repeat(40); release.source.checkoutSha = release.revision;
  release.releaseId = release.revision + "-1234567890abcdef";
  for (const image of release.images) image.revision = release.revision;
  writeFileSync(releaseFile, JSON.stringify(release));
  const config = JSON.parse(readFileSync(input.configFile, "utf8")); config.gatewayPort += 1;
  writeFileSync(input.configFile, JSON.stringify(config));
  const second = await deployRelease(input, success);
  assert.notEqual(second.configVersion, first.configVersion);
  await assert.rejects(deployRelease(input, { ...success, executeCompose: async () => { throw new Error("failed upgrade"); } }));
  const restored = await deployRelease({ stateDirectory: input.stateDirectory, secretsFile: input.secretsFile, rollback: true }, success);
  assert.equal(restored.releaseId, second.releaseId);
  assert.equal(state(input).previous.releaseId, first.releaseId);
  const rollback = await deployRelease({ stateDirectory: input.stateDirectory, secretsFile: input.secretsFile, rollback: true }, success);
  assert.equal(rollback.releaseId, first.releaseId);
  assert.equal(rollback.configVersion, first.configVersion);
  assert.equal(rollback.secretsPreserved, true);
  assert.equal(state(input).previous.releaseId, second.releaseId);
});

test("相同初始化SQL使用稳定挂载路径，重部署不因attempt路径变化而重建数据库", async () => {
  const input = fixture(); const paths = [];
  const adapter = { ...success, executeCompose: async ({ composeArgs, command }) => {
    if (command[0] === "up") {
      const compose = JSON.parse(readFileSync(composeArgs.at(-1), "utf8"));
      paths.push(compose.services.postgres.volumes.find((volume) => typeof volume === "object")?.source);
    }
  } };
  await deployRelease(input, adapter); await deployRelease(input, adapter);
  assert.ok(paths[0]); assert.equal(paths[0], paths[1]);
  assert.equal(readFileSync(paths[0], "utf8"), "SELECT 1;\n");
});

test("部署锁冲突不能改写另一个部署的成功指针", async () => {
  const input = fixture(); await deployRelease(input, success); const before = readFileSync(join(input.stateDirectory, "state.json"));
  mkdirSync(join(input.stateDirectory, "deploy.lock"));
  await assert.rejects(deployRelease(input, success), /部署锁/);
  assert.deepEqual(readFileSync(join(input.stateDirectory, "state.json")), before);
});
