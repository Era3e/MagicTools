import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";

const MAX_OUTPUT_BYTES = 128 * 1024;
const COPY_ENV_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "ComSpec",
  "LANG",
  "LC_ALL",
  "TZ",
  "NUMBER_OF_PROCESSORS",
];

export function buildIsolatedEnv({ parentEnv = process.env, workspace, home, taskFile, phase }) {
  const env = {};
  for (const key of COPY_ENV_KEYS) {
    if (parentEnv[key] !== undefined) env[key] = parentEnv[key];
  }

  env.HOME = home;
  env.USERPROFILE = home;
  env.APPDATA = join(home, "AppData", "Roaming");
  env.LOCALAPPDATA = join(home, "AppData", "Local");
  env.TMP = join(workspace, "tmp");
  env.TEMP = env.TMP;
  env.USER = "magictools-executor";
  env.USERNAME = "magictools-executor";
  env.NODE_ENV = parentEnv.NODE_ENV === "test" ? "test" : "production";
  env.GIT_TERMINAL_PROMPT = "0";
  env.GIT_CONFIG_GLOBAL = join(home, "git-config");
  env.GIT_CONFIG_SYSTEM = join(home, "git-system-config");
  env.MT_EXECUTOR_WORKSPACE = workspace;
  env.MT_EXECUTOR_TASK = taskFile;
  env.MT_EXECUTOR_PHASE = phase;
  return env;
}

export async function runIsolatedProcess({ command, cwd, env, timeoutMs, signal }) {
  if (!Array.isArray(command) || !command.length || command.some((value) => typeof value !== "string")) {
    throw new Error("隔离进程命令必须是字符串数组");
  }
  const startedAt = Date.now();
  const runtimeCommand = resolveRuntime(command);
  const child = spawn(runtimeCommand[0], runtimeCommand.slice(1), {
    cwd,
    env,
    windowsHide: true,
    detached: process.platform === "win32" ? false : true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let stdoutTruncated = false;
  let stderrTruncated = false;
  let timedOut = false;
  let externallyCancelled = false;

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    const next = stdout + chunk;
    if (Buffer.byteLength(next, "utf8") > MAX_OUTPUT_BYTES) {
      stdoutTruncated = true;
      stdout = next.slice(0, MAX_OUTPUT_BYTES);
    } else stdout = next;
  });
  child.stderr.on("data", (chunk) => {
    const next = stderr + chunk;
    if (Buffer.byteLength(next, "utf8") > MAX_OUTPUT_BYTES) {
      stderrTruncated = true;
      stderr = next.slice(0, MAX_OUTPUT_BYTES);
    } else stderr = next;
  });

  const timer = setTimeout(() => {
    timedOut = true;
    killProcessTree(child.pid);
  }, Math.max(1, timeoutMs));
  const abort = () => {
    externallyCancelled = signal?.reason instanceof Error ? true : Boolean(signal?.aborted);
    killProcessTree(child.pid);
  };
  signal?.addEventListener("abort", abort, { once: true });

  let exitCode;
  try {
    [exitCode] = await once(child, "close");
  } catch (spawnError) {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    throw new Error("隔离进程启动失败：" + sanitizeDiagnostic(spawnError?.message ?? spawnError));
  }
  clearTimeout(timer);
  signal?.removeEventListener("abort", abort);

  const result = {
    exitCode,
    status: timedOut ? "timeout" : externallyCancelled ? "cancelled" : exitCode === 0 ? "success" : "error",
    timedOut,
    cancelled: externallyCancelled,
    durationMs: Date.now() - startedAt,
    stdout: sanitizeDiagnostic(stdout),
    stderr: sanitizeDiagnostic(stderr),
    stdoutTruncated,
    stderrTruncated,
  };
  if (result.status !== "success") {
    const reason = timedOut ? "隔离进程超时" : externallyCancelled ? "隔离进程被取消" : "隔离进程失败";
    const error = new Error(reason + "：" + (result.stderr || result.stdout || ("exit " + exitCode)).slice(0, 1200));
    error.result = result;
    throw error;
  }
  return result;
}

export function killProcessTree(pid) {
  if (!pid || pid <= 0) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // 进程可能已经退出；保留原诊断继续返回。
    }
  }
}

export function sanitizeDiagnostic(value) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/https:\/\/([^/\s:@]+):([^/\s@]+)@/g, "https://[redacted]@")
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+|xox[baprs]-[A-Za-z0-9-]+)\b/g, "[redacted]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/gi, "$1[redacted]");
}

function resolveRuntime(command) {
  const next = command.slice();
  if (process.platform === "win32" && ["pnpm", "npm"].includes(next[0])) next[0] += ".cmd";
  return next;
}

function once(eventEmitter, event) {
  return new Promise((resolve, reject) => {
    eventEmitter.once("error", reject);
    eventEmitter.once(event, (...args) => resolve(args));
  });
}
