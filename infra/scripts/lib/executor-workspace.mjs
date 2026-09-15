import { execFile } from "node:child_process";
import { lstatSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize, relative, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_CHANGED_FILES = 500;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function prepareCoderWorkspace({ repository, baseSha, runDir, task, gitPrefix = [] }) {
  const workspace = join(runDir, "workspace");
  const coder = join(workspace, "coder");
  const home = join(workspace, "home");
  const evidence = join(runDir, "evidence");
  const tmp = join(workspace, "tmp");
  mkdirSync(join(home, "AppData", "Roaming"), { recursive: true });
  mkdirSync(join(home, "AppData", "Local"), { recursive: true });
  mkdirSync(evidence, { recursive: true });
  mkdirSync(home, { recursive: true });
  mkdirSync(tmp, { recursive: true });
  writeFileSync(join(home, "git-config"), "");
  writeFileSync(join(home, "git-system-config"), "");

  await git(undefined, [...gitPrefix, "clone", "--no-checkout", repository, coder]);
  await git(coder, ["config", "core.autocrlf", "false"]);
  await git(coder, ["checkout", "--detach", baseSha]);
  await git(coder, ["config", "user.name", "MagicTools Executor"]);
  await git(coder, ["config", "user.email", "executor@magictools.local"]);
  await git(coder, ["config", "core.hooksPath", join(workspace, "empty-hooks")]);
  mkdirSync(join(workspace, "empty-hooks"), { recursive: true });

  const taskFile = join(workspace, "task.json");
  writeTaskFile(taskFile, task);
  return { workspace, coder, home, evidence, tmp, taskFile };
}

export function writeTaskFile(path, task) {
  writeFileSync(path, JSON.stringify(task, null, 2) + "\n", "utf8");
}

export async function collectChangedPaths(repository) {
  const tracked = await git(repository, ["diff", "--name-only", "HEAD"]);
  const untracked = await git(repository, ["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...splitLines(tracked), ...splitLines(untracked)])].sort();
}

export async function assertAllowedChanges({ repository, allowedPaths, inspectPath = lstatSync }) {
  const changed = await collectChangedPaths(repository);
  if (!changed.length) throw new Error("编码进程没有产生可提交改动");
  if (changed.length > MAX_CHANGED_FILES) throw new Error(`改动文件超过 ${MAX_CHANGED_FILES} 个上限`);

  const normalizedAllowed = allowedPaths.map((path) => normalizeGitPath(path));
  for (const pathValue of changed) {
    const normalized = normalizeGitPath(pathValue);
    if (!normalizedAllowed.some((allowed) => normalized === allowed || normalized.startsWith(allowed + "/"))) {
      throw new Error("契约外路径：" + pathValue);
    }
    const full = join(repository, normalized);
    let info;
    try {
      info = inspectPath(full);
    } catch {
      continue;
    }
    if (info.isSymbolicLink()) throw new Error("候选改动包含符号链接：" + pathValue);
    if (info.isFile() && info.size > MAX_FILE_BYTES) throw new Error("候选文件超过 10MB 上限：" + pathValue);
    const repositoryRoot = realpathSync(repository);
    const actualPath = realpathSync(full);
    const relativePath = relative(repositoryRoot, actualPath);
    if (!relativePath || relativePath === ".." || relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error("候选路径解析到工作区外：" + pathValue);
    }
  }
  return changed;
}

export async function commitCandidate({ repository, message, identity }) {
  const changed = await assertAllowedChangesInternal(repository);
  if (!changed.length) throw new Error("编码进程没有产生可提交改动");
  await git(repository, ["add", "--", ...changed]);
  await git(repository, [
    "-c", "user.name=" + identity.name,
    "-c", "user.email=" + identity.email,
    "commit", "-m", message,
  ]);
  return (await git(repository, ["rev-parse", "HEAD"])).trim();
}

export async function cloneAcceptanceWorkspace({ repository, candidateSha, runDir }) {
  const acceptance = join(runDir, "workspace", "acceptance");
  await git(undefined, ["clone", "--no-checkout", repository, acceptance]);
  await git(acceptance, ["checkout", "--detach", candidateSha]);
  const actual = (await git(acceptance, ["rev-parse", "HEAD"])).trim();
  if (actual !== candidateSha) throw new Error("独立验收工作区候选 SHA 不匹配");
  return acceptance;
}


async function assertAllowedChangesInternal(repository) {
  return collectChangedPaths(repository);
}

async function git(cwd, args) {
  const { stdout } = await execFileAsync("git", args, {
    cwd: cwd ?? process.cwd(),
    windowsHide: true,
    maxBuffer: MAX_FILE_BYTES,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
    },
  });
  return stdout;
}

function splitLines(value) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function normalizeGitPath(pathValue) {
  const normalized = normalize(pathValue).split(sep).join("/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("..") || normalized.includes("\\") || normalized.includes("//")) {
    throw new Error("非法 Git 路径：" + pathValue);
  }
  return normalized;
}
