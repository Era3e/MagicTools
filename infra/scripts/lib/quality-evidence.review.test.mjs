import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { captureValidationIdentity, verifyQualityEvidence } from "./quality-evidence.mjs";
import { runProcess } from "./validation-process.mjs";
import { QUALITY_STAGES } from "../quality-gate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const work = join(dirname(root), "quality-review-fixtures");
mkdirSync(work, { recursive: true });

function fixture(label) {
  const directory = mkdtempSync(join(work, label + "-"));
  const repo = join(directory, "repo");
  mkdirSync(repo);
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Independent Quality Review");
  git("config", "user.email", "review@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.autocrlf", "false");
  git("config", "core.hooksPath", join(directory, "no-hooks"));
  git("remote", "add", "origin", "https://github.com/review/fixture.git");
  writeFileSync(join(repo, ".gitignore"), ".qa/\n");
  writeFileSync(join(repo, "source.txt"), "original\n");
  git("add", "."); git("commit", "-m", "fixture base");
  return { directory, repo, git };
}

function identity() {
  return { candidateSha: "a".repeat(40), checkoutSha: "b".repeat(40), baseSha: "c".repeat(40),
    tree: "d".repeat(40), fingerprint: "e".repeat(64), repository: "review/fixture", runId: "123", attempt: "1",
    validationId: "independent-current-run", clean: true };
}

function databaseEvidence() {
  const manifest = JSON.parse(readFileSync(join(root, "infra/testing/database-suites.json"), "utf8"));
  return { schema: "magictools-database-validation/1", success: true, runId: "independent-db-run", identity: identity(),
    startedAt: "2026-09-12T00:00:01.000Z", finishedAt: "2026-09-12T00:00:02.000Z",
    mode: { database: "real", external: "stub-or-mock", liveModel: "not-run" },
    projects: manifest.projects.map((project) => ({ project: project.id, success: true,
      files: project.files.map((file) => ({ path: file.path, success: true, exitCode: 0,
        counts: { files: 1, passed: file.minimumTests, failed: 0, skipped: 0 },
        verificationReport: { success: true, numFailedTests: 0, numFailedTestSuites: 0, numPendingTests: 0, numTodoTests: 0,
          testResults: [{ name: project.directory + "/" + file.path, status: "passed",
            assertionResults: Array.from({ length: file.minimumTests }, (_, index) => ({ status: "passed", fullName: "fixture " + index })) }] },
      })) })) };
}

function report() {
  return { schema: "magictools-quality-evidence/1", success: true, identity: identity(),
    startedAt: "2026-09-12T00:00:00.000Z", finishedAt: "2026-09-12T00:00:03.000Z",
    mode: { database: "real", external: "stub-or-mock", liveModel: "not-run" },
    stages: QUALITY_STAGES.map((id) => ({ id, status: "passed", exitCode: 0,
      ...(id === "database" ? { database: databaseEvidence() } : {}) })) };
}

function verify(value) {
  const databaseManifest = JSON.parse(readFileSync(join(root, "infra/testing/database-suites.json"), "utf8"));
  return verifyQualityEvidence(value, { identity: identity(), stages: QUALITY_STAGES, databaseManifest });
}

test("独立验收：Git 指纹感知已跟踪、暂存及未跟踪文件内容变化", () => {
  const { repo, git } = fixture("fingerprint");
  const initial = captureValidationIdentity(repo, {}, "same-run");
  assert.equal(initial.clean, true);
  writeFileSync(join(repo, "source.txt"), "modified\n");
  const modified = captureValidationIdentity(repo, {}, "same-run");
  assert.notEqual(modified.fingerprint, initial.fingerprint);
  assert.equal(modified.clean, false);
  git("add", "source.txt");
  assert.notEqual(captureValidationIdentity(repo, {}, "same-run").fingerprint, modified.fingerprint);
  writeFileSync(join(repo, "new.txt"), "untracked one\n");
  const added = captureValidationIdentity(repo, {}, "same-run");
  writeFileSync(join(repo, "new.txt"), "untracked two\n");
  assert.notEqual(captureValidationIdentity(repo, {}, "same-run").fingerprint, added.fingerprint);
});

test("独立验收：PR 合并提交绑定实际 head 和 base，错误基线不能借正确 head 通过", () => {
  const { directory, repo, git } = fixture("merge");
  git("checkout", "-b", "feature");
  writeFileSync(join(repo, "feature.txt"), "feature\n"); git("add", "."); git("commit", "-m", "feature");
  const candidate = git("rev-parse", "HEAD");
  git("checkout", "main");
  writeFileSync(join(repo, "base.txt"), "base progression\n"); git("add", "."); git("commit", "-m", "base progression");
  const base = git("rev-parse", "HEAD");
  git("merge", "--no-ff", "feature", "-m", "test merge");
  const checkout = git("rev-parse", "HEAD");
  const eventPath = join(directory, "event.json");
  const event = { pull_request: { head: { sha: candidate }, base: { sha: base } } };
  writeFileSync(eventPath, JSON.stringify(event));
  const env = { GITHUB_ACTIONS: "true", GITHUB_SHA: checkout, GITHUB_EVENT_PATH: eventPath,
    GITHUB_REPOSITORY: "review/fixture", GITHUB_RUN_ID: "901", GITHUB_RUN_ATTEMPT: "2" };
  const captured = captureValidationIdentity(repo, env, "merge-run");
  assert.equal(captured.candidateSha, candidate); assert.equal(captured.baseSha, base);
  assert.equal(captured.checkoutSha, checkout); assert.equal(captured.runId, "901");
  event.pull_request.base.sha = "f".repeat(40);
  writeFileSync(eventPath, JSON.stringify(event));
  assert.throws(() => captureValidationIdentity(repo, env, "merge-run"), /基线|base|候选|checkout/);
});

test("独立验收：候选、checkout、base、工作树和运行身份任一变化均拒绝旧证据", () => {
  assert.doesNotThrow(() => verify(report()));
  for (const key of ["candidateSha", "checkoutSha", "baseSha", "tree", "fingerprint", "repository", "runId", "attempt", "validationId"]) {
    const value = report(); value.identity[key] = "different";
    assert.throws(() => verify(value), key);
  }
});

test("独立验收：CI 身份字段缺失或工作树不干净时不生成有效身份", () => {
  const { directory, repo, git } = fixture("ci-context");
  const sha = git("rev-parse", "HEAD");
  const eventPath = join(directory, "event.json");
  writeFileSync(eventPath, JSON.stringify({ pull_request: { head: { sha }, base: { sha } } }));
  const env = { GITHUB_ACTIONS: "true", GITHUB_SHA: sha, GITHUB_EVENT_PATH: eventPath,
    GITHUB_REPOSITORY: "review/fixture", GITHUB_RUN_ID: "901", GITHUB_RUN_ATTEMPT: "2" };
  for (const key of ["GITHUB_REPOSITORY", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT"]) {
    const incomplete = { ...env }; delete incomplete[key];
    assert.throws(() => captureValidationIdentity(repo, incomplete, "ci-run"));
  }
  writeFileSync(join(repo, "untracked.txt"), "not part of candidate\n");
  assert.throws(() => captureValidationIdentity(repo, env, "ci-run"), /工作树/);
});

test("独立验收：阶段缺失、重复、换序、非零退出及失败状态不能以 success 覆盖", () => {
  for (const change of [
    (value) => value.stages.pop(),
    (value) => { value.stages[1] = { ...value.stages[0] }; },
    (value) => value.stages.reverse(),
    (value) => { value.stages[0].exitCode = 2; },
    (value) => { value.stages[0].status = "failed"; },
    (value) => { value.stages[0].status = "skipped"; },
  ]) { const value = report(); change(value); assert.throws(() => verify(value)); }
});

test("独立验收：缺失或失败的数据库明细不能靠阶段 passed 得到成功回执", () => {
  for (const change of [
    (stage) => { delete stage.database; },
    (stage) => { stage.database.success = false; },
    (stage) => { stage.database.projects = []; },
    (stage) => { stage.database.projects[0].files = []; },
    (stage) => { stage.database.projects[0].files[0].counts.skipped = 1; },
    (stage) => { stage.database.projects[0].files[0].success = false; },
    (stage) => { stage.database.identity.validationId = "older-run"; },
    (stage) => { stage.database.projects[0].files[0].verificationReport.testResults = []; },
    (stage) => { stage.database.projects[0].files[0].verificationReport.testResults[0].assertionResults[0].status = "skipped"; },
  ]) { const value = report(); change(value.stages.at(-1)); assert.throws(() => verify(value)); }
});

test("独立验收：缺模式、伪报真实模型或数据库 mock 不能作为当前模式证据", () => {
  for (const change of [
    (value) => { delete value.mode; },
    (value) => { value.mode.liveModel = "passed"; },
    (value) => { value.mode.database = "mock"; },
    (value) => { value.stages.at(-1).database.mode.database = "mock"; },
  ]) { const value = report(); change(value); assert.throws(() => verify(value)); }
});

test("独立验收：调用方未提供可信数据库清单时拒绝数据库成功声明", () => {
  assert.throws(() => verifyQualityEvidence(report(), { identity: identity(), stages: QUALITY_STAGES }), /清单/);
});

function runnerFixture(label, commandBody) {
  const value = fixture(label);
  const scripts = join(value.repo, "infra/scripts");
  mkdirSync(join(scripts, "lib"), { recursive: true });
  for (const file of ["quality-gate.mjs", "lib/quality-evidence.mjs", "lib/validation-process.mjs", "lib/database-validation.mjs"]) {
    writeFileSync(join(scripts, file), readFileSync(join(root, "infra/scripts", file)));
  }
  writeFileSync(join(scripts, "test-database.mjs"), `import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export async function runDatabaseValidation({ identity }) { return { ...JSON.parse(readFileSync(join(root, "database-fixture.json"), "utf8")), identity }; }
`);
  writeFileSync(join(value.repo, "database-fixture.json"), JSON.stringify(databaseEvidence()));
  const manifest = JSON.parse(readFileSync(join(root, "infra/testing/database-suites.json"), "utf8"));
  mkdirSync(join(value.repo, "infra/testing"), { recursive: true });
  writeFileSync(join(value.repo, "infra/testing/database-suites.json"), JSON.stringify(manifest));
  for (const project of manifest.projects) {
    mkdirSync(join(value.repo, project.directory, "src"), { recursive: true });
    for (const file of project.files) {
      writeFileSync(join(value.repo, project.directory, file.path), "// @database-integration\n");
    }
    writeFileSync(join(value.repo, project.directory, "vitest.config.ts"), "export default { test: { exclude: " + JSON.stringify(project.files.map((file) => file.path)) + " } };\n");
  }
  writeFileSync(join(value.repo, "fake-pnpm.cjs"), commandBody);
  value.git("add", "."); value.git("commit", "-m", "runner fixture");
  return value;
}

function executeRunner(value) {
  const result = spawnSync(process.execPath, [join(value.repo, "infra/scripts/quality-gate.mjs")], {
    cwd: value.repo, encoding: "utf8", timeout: 15000, windowsHide: true,
    env: { ...process.env, GITHUB_ACTIONS: "false", npm_execpath: join(value.repo, "fake-pnpm.cjs") },
  });
  assert.equal(result.error, undefined);
  const parent = join(value.repo, ".qa/quality");
  const directories = readdirSync(parent);
  assert.equal(directories.length, 1);
  return { result, evidence: JSON.parse(readFileSync(join(parent, directories[0], "quality.json"), "utf8")) };
}

test("独立验收：真实质量启动器在首阶段失败后保留失败回执与原退出码", () => {
  const value = runnerFixture("failed-stage", "process.exit(7);\n");
  const { result, evidence } = executeRunner(value);
  assert.equal(result.status, 1); assert.equal(evidence.success, false);
  assert.equal(evidence.identity.checkoutSha, value.git("rev-parse", "HEAD"));
  assert.equal(evidence.stages.length, 1); assert.equal(evidence.stages[0].id, "lint");
  assert.equal(evidence.stages[0].status, "failed"); assert.equal(evidence.stages[0].exitCode, 7);
  assert.ok(evidence.error && evidence.finishedAt && evidence.stages[0].finishedAt);
});

test("独立验收：真实启动器完整阶段正例可产出经独立复核的成功回执", () => {
  const value = runnerFixture("successful-run", "process.exit(0);\n");
  const { result, evidence } = executeRunner(value);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(evidence.success, true);
  assert.deepEqual(evidence.stages.map((stage) => stage.id), QUALITY_STAGES);
  assert.ok(evidence.stages.every((stage) => stage.status === "passed" && stage.exitCode === 0 && stage.finishedAt));
  const current = captureValidationIdentity(value.repo, {}, evidence.identity.validationId);
  const databaseManifest = JSON.parse(readFileSync(join(value.repo, "infra/testing/database-suites.json"), "utf8"));
  assert.doesNotThrow(() => verifyQualityEvidence(evidence, { identity: current, stages: QUALITY_STAGES, databaseManifest }));
});

test("独立验收：运行期间源内容变化，即使全部命令返回零也必须留下失败回执", () => {
  const value = runnerFixture("changed-during-run", `if (process.argv.includes("eslint")) require("node:fs").appendFileSync("source.txt", "changed during lint\\n");\n`);
  const { result, evidence } = executeRunner(value);
  assert.equal(result.status, 1); assert.equal(evidence.success, false);
  assert.match(evidence.error, /fingerprint|身份不匹配|工作树/);
  assert.equal(evidence.stages.length, QUALITY_STAGES.length);
});

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (error) { if (error.code === "ESRCH") return false; throw error; }
}

test("独立验收：超时终止自身父子进程，调用方继续存活", async () => {
  const directory = mkdtempSync(join(work, "timeout-"));
  const parentFile = join(directory, "parent.pid");
  const leafFile = join(directory, "leaf.pid");
  writeFileSync(join(directory, "leaf.cjs"), `require("node:fs").writeFileSync(${JSON.stringify(leafFile)}, String(process.pid)); setInterval(() => {}, 1000);`);
  writeFileSync(join(directory, "parent.cjs"), `require("node:fs").writeFileSync(${JSON.stringify(parentFile)}, String(process.pid)); require("node:child_process").spawn(process.execPath, [${JSON.stringify(join(directory, "leaf.cjs"))}], { windowsHide: true, stdio: "ignore" }); setInterval(() => {}, 1000);`);
  let pids = [];
  try {
    await assert.rejects(runProcess(process.execPath, [join(directory, "parent.cjs")], { cwd: directory, timeoutMs: 2000 }), /超过时限/);
    pids = [parentFile, leafFile].map((path) => Number(readFileSync(path, "utf8")));
    assert.ok(pids.every((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid));
    const deadline = Date.now() + 2000;
    while (pids.some(alive) && Date.now() < deadline) await delay(25);
    assert.deepEqual(pids.map(alive), [false, false]);
    assert.equal(alive(process.pid), true);
  } finally {
    for (const pid of pids) if (alive(pid)) process.kill(pid);
  }
});
