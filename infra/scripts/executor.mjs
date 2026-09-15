#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { ExecutorGitHubClient } from "./lib/executor-github.mjs";
import { ExecutorManagerClient } from "./lib/executor-manager.mjs";
import { runExecutionJob } from "./lib/executor-run.mjs";
import { sanitizeDiagnostic } from "./lib/executor-process.mjs";

const execFileAsync = promisify(execFile);

export function parseExecutorConfig(env = process.env) {
  const errors = [];
  const managerUrl = env.MT_EXECUTOR_MANAGER_URL ?? "";
  const managerToken = env.MT_EXECUTOR_MANAGER_TOKEN ?? "";
  const githubToken = env.MT_EXECUTOR_GITHUB_TOKEN ?? "";
  const workspaceRoot = env.MT_EXECUTOR_WORKSPACE_ROOT ?? join(process.cwd(), ".executor-runs");
  const baseBranch = env.MT_EXECUTOR_BASE_BRANCH ?? "main";
  const leaseMilliseconds = Number(env.MT_EXECUTOR_LEASE_MILLISECONDS ?? 60_000);
  const heartbeatMilliseconds = Number(env.MT_EXECUTOR_HEARTBEAT_MILLISECONDS ?? 20_000);
  let coderCommand = [];
  try {
    const parsed = JSON.parse(env.MT_EXECUTOR_CODER_COMMAND ?? "[]");
    if (!Array.isArray(parsed) || !parsed.length || parsed.some((value) => typeof value !== "string")) {
      throw new Error("must be a non-empty string array");
    }
    coderCommand = parsed;
  } catch (error) {
    errors.push("MT_EXECUTOR_CODER_COMMAND 必须是非空 JSON 字符串数组：" + error.message);
  }
  if (!/^https?:\/\//.test(managerUrl)) errors.push("MT_EXECUTOR_MANAGER_URL 必须是 HTTP(S) 地址");
  if (managerToken.length < 32) errors.push("MT_EXECUTOR_MANAGER_TOKEN 至少 32 个字符");
  if (githubToken.length < 32) errors.push("MT_EXECUTOR_GITHUB_TOKEN 至少 32 个字符");
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(env.MT_EXECUTOR_ID ?? "magictools-executor")) errors.push("MT_EXECUTOR_ID 格式非法");
  if (!/^(?!\/)(?!.*\/\/)[A-Za-z0-9._/-]+$/.test(baseBranch)) errors.push("MT_EXECUTOR_BASE_BRANCH 格式非法");
  if (!Number.isInteger(leaseMilliseconds) || leaseMilliseconds < 5_000 || leaseMilliseconds > 3_600_000) {
    errors.push("MT_EXECUTOR_LEASE_MILLISECONDS 必须是 5000-3600000 的整数");
  }
  if (!Number.isInteger(heartbeatMilliseconds) || heartbeatMilliseconds < 5_000 || heartbeatMilliseconds > 3_600_000) {
    errors.push("MT_EXECUTOR_HEARTBEAT_MILLISECONDS 必须是 5000-3600000 的整数");
  }
  if (Number.isInteger(heartbeatMilliseconds) && Number.isInteger(leaseMilliseconds) && heartbeatMilliseconds > leaseMilliseconds) {
    errors.push("心跳间隔不能大于租约时长");
  }

  return {
    valid: errors.length === 0,
    errors,
    managerUrl,
    managerToken,
    githubToken,
    coderCommand,
    workspaceRoot,
    baseBranch,
    executorId: env.MT_EXECUTOR_ID ?? "magictools-executor",
    leaseMilliseconds,
    heartbeatMilliseconds,
    once: env.MT_EXECUTOR_ONCE === "1" || process.argv.includes("--once"),
  };
}

async function main() {
  const config = parseExecutorConfig();
  if (process.argv.includes("--check-config")) {
    if (!config.valid) {
      console.error(JSON.stringify({ valid: false, errors: config.errors }, null, 2));
      process.exit(1);
    }
    console.log(JSON.stringify({ valid: true, liveCoder: "not-run", liveGithub: "not-run" }, null, 2));
    return;
  }
  if (!config.valid) throw new Error("执行器配置无效：" + config.errors.join("；"));

  mkdirSync(config.workspaceRoot, { recursive: true });
  const managerApi = new ExecutorManagerClient({
    baseUrl: config.managerUrl,
    token: config.managerToken,
    executorId: config.executorId,
    leaseMilliseconds: config.leaseMilliseconds,
  });
  const github = new ExecutorGitHubClient({ token: config.githubToken });
  const gitPrefix = ["-c", "http.https://github.com/.extraheader=AUTHORIZATION: bearer " + config.githubToken];

  for (;;) {
    const claimed = await managerApi.claim();
    if (!claimed) {
      if (config.once) break;
      await sleep(5_000);
      continue;
    }
    const baseSha = await github.getBranchSha(claimed.contract.repository, config.baseBranch);
    const job = { ...claimed, baseSha, coderCommand: config.coderCommand };
    try {
      await runExecutionJob({
        job,
        config: {
          workspaceRoot: config.workspaceRoot,
          baseBranch: config.baseBranch,
          leaseMilliseconds: config.leaseMilliseconds,
          heartbeatMilliseconds: config.heartbeatMilliseconds,
          parentEnv: process.env,
          gitPrefix,
        },
        manager: managerApi,
        publish: async ({ candidateSha, changedPaths }) => publishCandidate({
          github,
          job,
          config,
          repository,
          candidateSha,
          changedPaths,
          gitPrefix,
        }),
      });
    } catch (error) {
      console.error(sanitizeDiagnostic(error?.stack ?? error?.message ?? error));
      if (config.once) throw error;
    }
    if (config.once) break;
  }
}

async function publishCandidate({ github, job, config, repository, candidateSha, changedPaths, gitPrefix }) {
  const branch = "auto/req-" + job.requirementId.slice(0, 8) + "/r" + job.contentRevision;
  await execFileAsync("git", [
    ...gitPrefix,
    "push", "origin", "HEAD:refs/heads/" + branch,
    "--force-with-lease",
  ], {
    cwd: repository,
    windowsHide: true,
  });

  const existing = await github.findOpenPullRequest(job.contract.repository, branch);
  if (existing) return existing;
  return github.createPullRequest({
    repository: job.contract.repository,
    title: "feat: 自动执行 " + job.requirement.title,
    head: branch,
    base: config.baseBranch,
    body: buildPrBody({ job, candidateSha, changedPaths }),
  });
}

function buildPrBody({ job, candidateSha, changedPaths }) {
  return [
    "## 自动执行候选",
    "",
    "- 需求：" + job.requirement.title,
    "- 内容修订：r" + job.contentRevision,
    "- base SHA：`" + job.baseSha + "`",
    "- candidate SHA：`" + candidateSha + "`",
    "- 允许路径：" + job.contract.allowedPaths.map((path) => "`" + path + "`").join(", "),
    "- 实际改动：" + changedPaths.map((path) => "`" + path + "`").join(", "),
    "",
    "### 独立验收",
    "",
    ...job.contract.acceptanceCommands.map((command, index) => "- [" + index + "] `" + command.join(" ") + "`"),
    "",
    "### 自检清单",
    "",
    "- [x] **沉淀层文档已同步**：由执行契约验收命令与后续 CI 文档门禁裁决",
    "- [x] **0 bug loop 验收记录**：编码候选 SHA 独立克隆后执行全部契约验收命令",
    "",
    "---",
    "Generated by MagicTools isolated executor.",
  ].join("\n");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(sanitizeDiagnostic(error?.stack ?? error?.message ?? error));
    process.exit(1);
  });
}
