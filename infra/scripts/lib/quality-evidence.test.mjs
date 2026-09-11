import test from "node:test";
import assert from "node:assert/strict";
import { captureValidationIdentity, verifyQualityEvidence } from "./quality-evidence.mjs";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

test("验证证据拒绝不同候选、工作树和旧运行回执", () => {
  const identity = { candidateSha: "a".repeat(40), checkoutSha: "b".repeat(40), baseSha: "c".repeat(40),
    tree: "d".repeat(40), fingerprint: "e".repeat(64), runId: "100", attempt: "2", validationId: "current-validation", repository: "Era3e/MagicTools" };
  const report = { schema: "magictools-quality-evidence/1", identity, success: true,
    mode: { database: "real", external: "stub-or-mock", liveModel: "not-run" }, stages: [{ id: "lint", status: "passed", exitCode: 0 }] };
  assert.doesNotThrow(() => verifyQualityEvidence(report, { identity, stages: ["lint"] }));
  for (const key of ["candidateSha", "checkoutSha", "baseSha", "fingerprint", "runId", "attempt", "validationId", "repository"]) {
    assert.throws(() => verifyQualityEvidence({ ...report, identity: { ...identity, [key]: "stale" } }, { identity, stages: ["lint"] }), /证据.*不匹配/);
  }
  assert.throws(() => verifyQualityEvidence({ ...report, stages: [] }, { identity, stages: ["lint"] }), /阶段/);
  assert.throws(() => verifyQualityEvidence({ ...report, stages: [{ id: "lint", status: "skipped", exitCode: 0 }] }, { identity, stages: ["lint"] }), /阶段/);
});

test("从实际 Git 工作树取证，拒绝伪报 CI 候选并感知未提交文件变化", () => {
  const temporary = mkdtempSync(join(tmpdir(), "mt-quality-"));
  const repo = join(temporary, "repo"); mkdirSync(repo);
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", windowsHide: true }).trim();
  try {
    git("init", "-b", "main");
    git("config", "user.name", "Validation Test"); git("config", "user.email", "validation@example.invalid");
    git("config", "commit.gpgsign", "false");
    git("remote", "add", "origin", "https://github.com/Era3e/MagicTools.git");
    writeFileSync(join(repo, "source.txt"), "original\n"); git("add", "."); git("commit", "-m", "fixture");
    const initial = captureValidationIdentity(repo, {}, "test-run");
    assert.equal(initial.checkoutSha, git("rev-parse", "HEAD"));
    writeFileSync(join(repo, "source.txt"), "changed\n");
    assert.notEqual(captureValidationIdentity(repo, {}, "test-run").fingerprint, initial.fingerprint);
    git("restore", "source.txt");
    writeFileSync(join(repo, "new.txt"), "untracked\n");
    assert.notEqual(captureValidationIdentity(repo, {}, "test-run").fingerprint, initial.fingerprint);
    const event = join(temporary, "event.json");
    writeFileSync(event, JSON.stringify({ pull_request: { head: { sha: "f".repeat(40) }, base: { sha: initial.checkoutSha } } }));
    assert.throws(() => captureValidationIdentity(repo, { GITHUB_ACTIONS: "true", GITHUB_SHA: initial.checkoutSha,
      GITHUB_EVENT_PATH: event, GITHUB_RUN_ID: "100", GITHUB_RUN_ATTEMPT: "1", GITHUB_REPOSITORY: "Era3e/MagicTools" }, "ci-run"), /候选|工作树/);
  } finally {
    if (!resolve(temporary).startsWith(resolve(tmpdir()) + sep + "mt-quality-")) throw new Error("Unexpected cleanup target");
    rmSync(temporary, { recursive: true, force: true });
  }
});
