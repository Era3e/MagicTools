import { spawn } from "node:child_process";

export function runProcess(command, args, { cwd, env = process.env, timeoutMs = 15 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, detached: process.platform !== "win32", stdio: "inherit" });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === "win32" && child.pid) spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
      else if (child.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill("SIGKILL"); } }
    }, timeoutMs);
    child.once("error", (err) => { clearTimeout(timer); reject(err); });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error("验证进程超过时限，已终止"));
      else resolve({ exitCode: code ?? 1, signal });
    });
  });
}

export function pnpmCommand(args) {
  const entry = process.env.npm_execpath;
  if (!entry) throw new Error("请使用 pnpm 命令运行验证入口，以便可靠定位包管理器");
  return /\.exe$/i.test(entry) ? [entry, args] : [process.execPath, [entry, ...args]];
}

export function runPnpm(args, options) {
  const [command, argv] = pnpmCommand(args);
  return runProcess(command, argv, options);
}
