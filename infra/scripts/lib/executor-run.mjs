import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildIsolatedEnv, runIsolatedProcess, sanitizeDiagnostic } from "./executor-process.mjs";
import {
  assertAllowedChanges,
  cloneAcceptanceWorkspace,
  commitCandidate,
  prepareCoderWorkspace,
} from "./executor-workspace.mjs";

export async function runExecutionJob({ job, config, manager, publish }) {
  const runDir = join(config.workspaceRoot, "run-" + job.jobId + "-" + job.runId);
  const hardDeadline = Date.now() + job.contract.maxDurationMinutes * 60_000;
  let phase = "prepare";
  let coderResult;
  const acceptanceResults = [];
  let heartbeatFailed = "";
  let activeAbort;
  const heartbeatTimer = setInterval(async () => {
    try {
      const alive = await manager.heartbeat(job);
      if (!alive) {
        heartbeatFailed = "执行租约心跳被拒绝";
        activeAbort?.abort(new Error(heartbeatFailed));
      }
    } catch (error) {
      heartbeatFailed = sanitizeDiagnostic(error?.message ?? error);
      activeAbort?.abort(new Error(heartbeatFailed));
    }
  }, Math.max(20, config.heartbeatMilliseconds ?? 30_000));
  heartbeatTimer.unref?.();

  try {
    await manager.heartbeat(job);
    phase = "clone";
    assertHardDeadline(hardDeadline);
    const task = {
      schema: "magictools-executor-task/1",
      jobId: job.jobId,
      runId: job.runId,
      requirementId: job.requirementId,
      requirementRevision: job.requirementRevision,
      contentRevision: job.contentRevision,
      attempt: job.attempt,
      baseSha: job.baseSha,
      requirement: job.requirement,
      contract: job.contract,
    };
    const prepared = await prepareCoderWorkspace({
      repository: job.contract.repository,
      baseSha: job.baseSha,
      runDir,
      task,
      gitPrefix: config.gitPrefix ?? [],
    });

    phase = "coder";
    assertHeartbeat(heartbeatFailed);
    const coderEnv = buildIsolatedEnv({
      parentEnv: config.parentEnv ?? process.env,
      workspace: prepared.workspace,
      home: prepared.home,
      taskFile: prepared.taskFile,
      phase: "coder",
    });
    const coderAbort = new AbortController();
    activeAbort = coderAbort;
    coderResult = await runIsolatedProcess({
      command: job.coderCommand,
      cwd: prepared.coder,
      env: coderEnv,
      timeoutMs: remainingMilliseconds(hardDeadline),
      signal: coderAbort.signal,
    });
    activeAbort = undefined;
    assertHeartbeat(heartbeatFailed);

    phase = "boundary";
    assertHardDeadline(hardDeadline);
    const changedPaths = await assertAllowedChanges({
      repository: prepared.coder,
      allowedPaths: job.contract.allowedPaths,
    });
    const candidateSha = await commitCandidate({
      repository: prepared.coder,
      message: "feat: 自动执行 " + job.requirementId,
      identity: { name: "MagicTools Executor", email: "executor@magictools.local" },
    });

    phase = "acceptance";
    assertHardDeadline(hardDeadline);
    assertHeartbeat(heartbeatFailed);
    const acceptanceWorkspace = await cloneAcceptanceWorkspace({
      repository: prepared.coder,
      candidateSha,
      runDir,
    });
    const acceptanceEnv = buildIsolatedEnv({
      parentEnv: config.parentEnv ?? process.env,
      workspace: prepared.workspace,
      home: prepared.home,
      taskFile: prepared.taskFile,
      phase: "acceptance",
    });
    for (const command of job.contract.acceptanceCommands) {
      const acceptanceAbort = new AbortController();
      activeAbort = acceptanceAbort;
      acceptanceResults.push(await runIsolatedProcess({
        command,
        cwd: acceptanceWorkspace,
        env: acceptanceEnv,
        timeoutMs: remainingMilliseconds(hardDeadline),
        signal: acceptanceAbort.signal,
      }));
      activeAbort = undefined;
      assertHeartbeat(heartbeatFailed);
    }

    phase = "publish";
    assertHardDeadline(hardDeadline);
    const published = await publish({
      job,
      runDir,
      repository: prepared.coder,
      candidateSha,
      baseSha: job.baseSha,
      changedPaths,
    });

    phase = "complete";
    assertHardDeadline(hardDeadline);
    const result = {
      status: "succeeded",
      jobId: job.jobId,
      runId: job.runId,
      requirementId: job.requirementId,
      contentRevision: job.contentRevision,
      attempt: job.attempt,
      baseSha: job.baseSha,
      candidateSha,
      changedPaths,
      acceptance: acceptanceResults.map((resultItem) => ({
        status: resultItem.status,
        exitCode: resultItem.exitCode,
        durationMs: resultItem.durationMs,
      })),
      prNumber: published.prNumber,
      prUrl: published.prUrl,
      branch: published.branch,
      evidence: writeEvidence({
        runDir,
        job,
        phase,
        changedPaths,
        candidateSha,
        published,
        coderResult,
        acceptanceResults,
        isolatedEnv: coderEnv,
      }),
    };
    await manager.complete(result);
    return result;
  } catch (error) {
    phase = phase === "complete" ? "complete-failed" : phase + "-failed";
    const message = sanitizeDiagnostic(error?.message ?? error).slice(0, 2000) || "执行器未知失败";
    try {
      writeFailureEvidence({ runDir, job, phase, message, coderResult, acceptanceResults });
    } catch {
      // 证据目录可能尚未创建；失败回写优先。
    }
    try {
      await manager.fail(message);
    } catch {
      // 保留原失败，Manager 回写失败由外层 CLI 记录。
    }
    throw error;
  } finally {
    if (heartbeatFailed && activeAbort) activeAbort.abort(new Error(heartbeatFailed));
    clearInterval(heartbeatTimer);
  }
}

function writeEvidence({ runDir, job, changedPaths, candidateSha, published, coderResult, acceptanceResults, isolatedEnv }) {
  const evidenceDir = join(runDir, "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  const coderLog = join(evidenceDir, "coder.log");
  const acceptanceLog = join(evidenceDir, "acceptance.log");
  writeFileSync(coderLog, formatProcessLog(coderResult));
  writeFileSync(acceptanceLog, acceptanceResults.map(formatProcessLog).join("\n"));
  const evidence = {
    schema: "magictools-executor-evidence/1",
    jobId: job.jobId,
    runId: job.runId,
    requirementId: job.requirementId,
    contentRevision: job.contentRevision,
    attempt: job.attempt,
    baseSha: job.baseSha,
    candidateSha,
    changedPaths,
    branch: published.branch,
    prUrl: published.prUrl,
    isolatedEnvironmentKeys: Object.keys(isolatedEnv).sort(),
    coder: summarizeProcess(coderResult),
    acceptance: acceptanceResults.map(summarizeProcess),
    logs: {
      coder: { path: coderLog, sha256: sha256Text(formatProcessLog(coderResult)) },
      acceptance: { path: acceptanceLog, sha256: sha256Text(acceptanceResults.map(formatProcessLog).join("\n")) },
    },
  };
  const evidencePath = join(evidenceDir, "evidence.json");
  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
  return {
    schema: evidence.schema,
    path: evidencePath,
    sha256: sha256Text(JSON.stringify(evidence, null, 2) + "\n"),
  };
}

function writeFailureEvidence({ runDir, job, phase, message, coderResult, acceptanceResults }) {
  const evidenceDir = join(runDir, "evidence");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, "failure.json"), JSON.stringify({
    schema: "magictools-executor-failure/1",
    jobId: job.jobId,
    runId: job.runId,
    phase,
    message,
    coder: coderResult ? summarizeProcess(coderResult) : null,
    acceptance: acceptanceResults.map(summarizeProcess),
  }, null, 2) + "\n");
}

function summarizeProcess(result) {
  return {
    status: result.status,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    stdoutTruncated: result.stdoutTruncated,
    stderrTruncated: result.stderrTruncated,
    stdoutSha256: sha256Text(result.stdout),
    stderrSha256: sha256Text(result.stderr),
  };
}

function formatProcessLog(result) {
  if (!result) return "";
  return [
    "status=" + result.status,
    "exitCode=" + String(result.exitCode),
    "durationMs=" + String(result.durationMs),
    "--- stdout ---",
    result.stdout,
    "--- stderr ---",
    result.stderr,
    "",
  ].join("\n");
}

function assertHeartbeat(heartbeatFailed) {
  if (heartbeatFailed) throw new Error("执行心跳失败：" + heartbeatFailed);
}

function remainingMilliseconds(deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("执行任务已超过契约硬截止时间");
  return remaining;
}

function assertHardDeadline(deadline) {
  if (deadline - Date.now() <= 0) throw new Error("执行任务已超过契约硬截止时间");
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}
