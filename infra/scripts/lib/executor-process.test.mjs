import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildIsolatedEnv, runIsolatedProcess } from "./executor-process.mjs";

test("编码进程只收到白名单环境和隔离 HOME", () => {
  const workspace = mkdtempSync(join(tmpdir(), "executor-env-"));
  const home = join(workspace, "home");
  const env = buildIsolatedEnv({
    parentEnv: {
      PATH: process.env.PATH,
      PATHEXT: process.env.PATHEXT,
      SystemRoot: process.env.SystemRoot,
      GITHUB_TOKEN: "github-secret",
      MANAGER_EXECUTOR_TOKEN: "manager-secret",
      DEEPSEEK_API_KEY: "model-secret",
      SSH_AUTH_SOCK: "/tmp/agent",
    },
    workspace,
    home,
    taskFile: join(workspace, "task.json"),
    phase: "coder",
  });

  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.MANAGER_EXECUTOR_TOKEN, undefined);
  assert.equal(env.DEEPSEEK_API_KEY, undefined);
  assert.equal(env.SSH_AUTH_SOCK, undefined);
  assert.equal(env.HOME, home);
  assert.equal(env.MT_EXECUTOR_WORKSPACE, workspace);
  assert.equal(env.MT_EXECUTOR_TASK, join(workspace, "task.json"));
  assert.equal(env.GIT_TERMINAL_PROMPT, "0");

  rmSync(workspace, { recursive: true, force: true });
});

test("隔离进程捕获 stdout/stderr 和退出码", async () => {
  const result = await runIsolatedProcess({
    command: [process.execPath, "-e", "console.log('out'); console.error('err')"],
    cwd: process.cwd(),
    env: process.env,
    timeoutMs: 5_000,
  });
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /out/);
  assert.match(result.stderr, /err/);
  assert.equal(result.timedOut, false);
});

test("超时终止进程树并保留诊断", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "executor-timeout-"));
  const marker = join(workspace, "grandchild-alive");
  const grandchild = `setInterval(() => require("node:fs").writeFileSync(${JSON.stringify(marker)}, "alive"), 100)`;
  const childScript = `
const cp = require("node:child_process");
const grandchild = cp.spawn(process.execPath, ["-e", ${JSON.stringify(grandchild)}], { stdio: "ignore" });
console.log("GRANDCHILD_PID=" + grandchild.pid);
setTimeout(() => {}, 5000);
`;
  let error;
  try {
    await runIsolatedProcess({
      command: [process.execPath, "-e", childScript],
      cwd: workspace,
      env: process.env,
      timeoutMs: 250,
    });
  } catch (caught) {
    error = caught;
  }
  assert.match(error?.message ?? "", /隔离进程超时/);
  const result = error?.result;
  assert.ok(result, "超时诊断结果必须保留");

  assert.equal(result.timedOut, true);
  assert.notEqual(result.exitCode, 0);
  assert.ok(result.stderr.length >= 0);
  const pid = Number(/GRANDCHILD_PID=(\d+)/.exec(result.stdout)?.[1]);
  assert.ok(Number.isInteger(pid) && pid > 0, "必须保留子孙进程 PID 诊断");
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.throws(() => process.kill(pid, 0), /ESRCH|EPERM/);

  rmSync(workspace, { recursive: true, force: true });
});

test("不存在的工作目录会立即失败并保留诊断", async () => {
  await assert.rejects(() => runIsolatedProcess({
    command: [process.execPath, "--version"],
    cwd: join(tmpdir(), "magictools-executor-definitely-missing-" + Date.now()),
    env: process.env,
    timeoutMs: 1_000,
  }), /启动失败|ENOENT/);
});
