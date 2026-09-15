import test from "node:test";
import assert from "node:assert/strict";
import { parseExecutorConfig } from "../executor.mjs";
import { parseRepository } from "./executor-github.mjs";

test("执行器配置必须完整且编码命令保持数组语义", () => {
  const config = parseExecutorConfig({
    MT_EXECUTOR_MANAGER_URL: "http://127.0.0.1:5004/api/manager",
    MT_EXECUTOR_MANAGER_TOKEN: "x".repeat(32),
    MT_EXECUTOR_GITHUB_TOKEN: "y".repeat(40),
    MT_EXECUTOR_CODER_COMMAND: JSON.stringify(["codex", "exec", "--sandbox", "workspace-write"]),
    MT_EXECUTOR_WORKSPACE_ROOT: ".executor-runs",
    MT_EXECUTOR_BASE_BRANCH: "main",
    MT_EXECUTOR_ONCE: "1",
  });
  assert.equal(config.valid, true);
  assert.deepEqual(config.coderCommand, ["codex", "exec", "--sandbox", "workspace-write"]);
  assert.equal(config.once, true);

  const heartbeatInvalid = parseExecutorConfig({
    MT_EXECUTOR_MANAGER_URL: "http://127.0.0.1:5004/api/manager",
    MT_EXECUTOR_MANAGER_TOKEN: "x".repeat(32),
    MT_EXECUTOR_GITHUB_TOKEN: "y".repeat(40),
    MT_EXECUTOR_CODER_COMMAND: JSON.stringify(["node", "--version"]),
    MT_EXECUTOR_HEARTBEAT_MILLISECONDS: "70000",
    MT_EXECUTOR_LEASE_MILLISECONDS: "60000",
  });
  assert.equal(heartbeatInvalid.valid, false);
  assert.ok(heartbeatInvalid.errors.some((error) => error.includes("心跳间隔不能大于租约时长")));

  const invalid = parseExecutorConfig({ MT_EXECUTOR_CODER_COMMAND: JSON.stringify(["codex"]) });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length >= 3, true);
});

test("执行仓库只接受 GitHub HTTPS 地址", () => {
  assert.deepEqual(parseRepository("https://github.com/Era3e/MagicTools"), ["Era3e", "MagicTools"]);
  assert.throws(() => parseRepository("https://gitlab.com/example/repo"), /GitHub/);
  assert.throws(() => parseRepository("file:///tmp/repo"), /GitHub/);
});
