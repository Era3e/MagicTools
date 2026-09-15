import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runExecutionJob } from "./executor-run.mjs";

test("执行器完成候选提交、独立验收、PR 发布和成功回写", async () => {
  const fixture = await fixtureRepository();
  const events = [];
  const result = await runExecutionJob({
    job: job(fixture),
    config: {
      workspaceRoot: fixture.root,
      baseBranch: "main",
      leaseMilliseconds: 60_000,
      heartbeatMilliseconds: 60_000,
      parentEnv: safeParentEnv(),
    },
    manager: fakeManager(events),
    publish: async ({ candidateSha }) => {
      events.push(["publish", candidateSha]);
      return { prNumber: 12, prUrl: "https://github.com/example/repo/pull/12" };
    },
  });

  assert.equal(result.status, "succeeded");
  assert.match(result.candidateSha, /^[0-9a-f]{40}$/);
  assert.deepEqual(result.changedPaths, ["safe.txt"]);
  assert.equal(result.prUrl, "https://github.com/example/repo/pull/12");
  assert.deepEqual(events.map(([name]) => name), ["heartbeat", "publish", "complete"]);
  const claimed = job(fixture);
  assert.equal(readFileSync(join(fixture.root, "run-" + claimed.jobId + "-" + claimed.runId, "evidence", "evidence.json"), "utf8").includes("github-secret"), false);

  rmSync(fixture.root, { recursive: true, force: true });
});

test("越界改动不发布并回写失败诊断", async () => {
  const fixture = await fixtureRepository("outside.txt", "bad\n");
  const events = [];
  await assert.rejects(
    () => runExecutionJob({
      job: job(fixture),
      config: {
        workspaceRoot: fixture.root,
        baseBranch: "main",
        leaseMilliseconds: 60_000,
      heartbeatMilliseconds: 60_000,
        parentEnv: safeParentEnv(),
      },
      manager: fakeManager(events),
      publish: async () => {
        throw new Error("must not publish");
      },
    }),
    /契约外路径/,
  );
  assert.deepEqual(events.map(([name]) => name), ["heartbeat", "fail"]);

  rmSync(fixture.root, { recursive: true, force: true });
});

async function fixtureRepository(changePath = "safe.txt", changeValue = "candidate\n") {
  const root = mkdtempSync(join(tmpdir(), "executor-run-"));
  const source = join(root, "source.git");
  git(undefined, "init", "--bare", source);
  const seed = join(root, "seed");
  mkdirSync(seed, { recursive: true });
  git(seed, "init", "--initial-branch=main");
  git(seed, "config", "core.autocrlf", "false");
  writeFileSync(join(seed, "safe.txt"), "base\n");
  writeFileSync(join(seed, "acceptance.cjs"), `if (require("node:fs").readFileSync(__dirname + "/safe.txt", "utf8").replace(/\\r\\n/g, "\\n") !== "candidate\\n") process.exit(1);\n`);
  git(seed, "add", ".");
  git(seed, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-m", "base");
  git(seed, "remote", "add", "origin", source);
  git(seed, "push", "origin", "HEAD:refs/heads/main");
  const baseSha = git(seed, "rev-parse", "HEAD");
  const coder = join(root, "coder-command.cjs");
  writeFileSync(coder, `require("node:fs").writeFileSync(process.env.MT_EXECUTOR_WORKSPACE + "/coder/${changePath}", ${JSON.stringify(changeValue)});\n`);
  return { root, repository: source, baseSha, coder };
}

function job(fixture) {
  return {
    jobId: "018f1c2c-1000-7000-8000-000000000001",
    runId: "018f1c2c-2000-7000-8000-000000000002",
    runToken: "run-token",
    attempt: 1,
    requirementId: "018f1c2c-3000-7000-8000-000000000003",
    requirementRevision: 2,
    contentRevision: 1,
    contract: {
      repository: fixture.repository,
      allowedPaths: ["safe.txt"],
      acceptanceCommands: [[process.execPath, "acceptance.cjs"]],
      maxDurationMinutes: 1,
      maxAttempts: 1,
      budgetCurrency: "CNY",
      budgetAmountCents: 100,
    },
    requirement: {
      title: "测试需求",
      description: "修改 safe.txt",
      scope: "safe.txt",
      acceptanceCriteria: ["safe.txt 更新"],
    },
    baseSha: fixture.baseSha,
    coderCommand: [process.execPath, fixture.coder],
  };
}

function fakeManager(events) {
  return {
    heartbeat: async () => {
      events.push(["heartbeat"]);
      return true;
    },
    complete: async (result) => {
      events.push(["complete", result]);
      return result;
    },
    fail: async (error) => {
      events.push(["fail", error]);
      return error;
    },
  };
}

function safeParentEnv() {
  return {
    PATH: process.env.PATH,
    PATHEXT: process.env.PATHEXT,
    SystemRoot: process.env.SystemRoot,
    GITHUB_TOKEN: "github-secret",
    MANAGER_EXECUTOR_TOKEN: "manager-secret",
  };
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd: cwd ?? process.cwd(), windowsHide: true }).toString("utf8").trim();
}
