import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  assertAllowedChanges,
  cloneAcceptanceWorkspace,
  commitCandidate,
  prepareCoderWorkspace,
} from "./executor-workspace.mjs";

test("候选提交只允许契约路径并可在独立工作区按 SHA 验收", async () => {
  const root = mkdtempSync(join(tmpdir(), "executor-workspace-"));
  const source = join(root, "source.git");
  git(undefined, "init", "--bare", source);
  const seed = join(root, "seed");
  mkdirSync(seed, { recursive: true });
  git(seed, "init", "--initial-branch=main");
  git(seed, "config", "core.autocrlf", "false");
  writeFileSync(join(seed, "safe.txt"), "base\n");
  git(seed, "add", ".");
  git(seed, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-m", "base");
  git(seed, "remote", "add", "origin", source);
  git(seed, "push", "origin", "HEAD:refs/heads/main");
  const baseSha = git(seed, "rev-parse", "HEAD");

  const runDir = join(root, "run");
  const prepared = await prepareCoderWorkspace({ repository: source, baseSha, runDir });
  const coder = prepared.coder;
  writeFileSync(join(coder, "safe.txt"), "candidate\n");
  await assertAllowedChanges({ repository: coder, allowedPaths: ["safe.txt"] });
  const candidate = await commitCandidate({
    repository: coder,
    message: "feat: 自动执行测试",
    identity: { name: "MagicTools Executor", email: "executor@magictools.local" },
  });
  assert.match(candidate, /^[0-9a-f]{40}$/);

  const acceptance = await cloneAcceptanceWorkspace({ repository: coder, candidateSha: candidate, runDir });
  assert.equal(git(acceptance, "rev-parse", "HEAD"), candidate);
  assert.equal(readFileSync(join(acceptance, "safe.txt"), "utf8").replace(/\r\n/g, "\n"), "candidate\n");

  rmSync(root, { recursive: true, force: true });
});

test("越界改动和符号链接在提交前拒绝", async () => {
  const root = mkdtempSync(join(tmpdir(), "executor-boundary-"));
  const repository = join(root, "repo");
  mkdirSync(repository, { recursive: true });
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "core.autocrlf", "false");
  mkdirSync(join(repository, "allowed"), { recursive: true });
  writeFileSync(join(repository, "allowed", "value.txt"), "base\n");
  git(repository, "add", ".");
  git(repository, "-c", "user.name=test", "-c", "user.email=test@example.com", "commit", "-m", "base");
  writeFileSync(join(repository, "outside.txt"), "bad\n");
  await assert.rejects(
    () => assertAllowedChanges({ repository, allowedPaths: ["allowed"] }),
    /契约外路径/,
  );

  rmSync(join(repository, "outside.txt"), { force: true });
  rmSync(join(repository, "allowed"), { recursive: true, force: true });
  writeFileSync(join(repository, "allowed"), "candidate\n");
  await assert.rejects(
    () => assertAllowedChanges({
      repository,
      allowedPaths: ["allowed"],
      inspectPath: () => ({ isSymbolicLink: () => true, isFile: () => false }),
    }),
    /符号链接/,
  );

  rmSync(root, { recursive: true, force: true });
});

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd: cwd ?? process.cwd(), windowsHide: true }).toString("utf8").trim();
}
