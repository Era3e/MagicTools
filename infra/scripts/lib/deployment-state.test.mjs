import test from "node:test";
import assert from "node:assert/strict";
import { deploymentSucceeded, deploymentFailed, rollbackTarget } from "./deployment-state.mjs";

const receipt = (name) => ({ attemptId: name.repeat(16), releaseId: name.repeat(40) + "-" + name.repeat(16), manifestSha256: name.repeat(64), configVersion: "d".repeat(64) });

test("A成功后B成功的正常回退指向A；C失败后的恢复指向最后成功的B", () => {
  const first = deploymentSucceeded(null, receipt("a"));
  assert.throws(() => rollbackTarget(first), /成功|回退/);
  const second = deploymentSucceeded(first, receipt("b"));
  assert.deepEqual(rollbackTarget(second), receipt("a"));
  const failed = deploymentFailed(second, "c".repeat(16));
  assert.deepEqual(failed.current, receipt("b"));
  assert.deepEqual(failed.previous, receipt("a"));
  assert.deepEqual(rollbackTarget(failed), receipt("b"));
});

test("恢复同一成功版本不会丢失更早回退点，切回前版后支持向前恢复", () => {
  const first = deploymentSucceeded(null, receipt("a"));
  const second = deploymentSucceeded(first, receipt("b"));
  const restored = deploymentSucceeded(deploymentFailed(second, "c".repeat(16)), { ...receipt("b"), attemptId: "e".repeat(16) });
  assert.deepEqual(restored.previous, receipt("a"));
  const rolledBack = deploymentSucceeded(restored, { ...receipt("a"), attemptId: "f".repeat(16) });
  assert.equal(rolledBack.previous.releaseId, receipt("b").releaseId);
});

test("首次失败没有成功目标；非法或不完整状态不能用作文件路径", () => {
  assert.throws(() => rollbackTarget(deploymentFailed(null, "a".repeat(16))), /成功|回退/);
  assert.throws(() => deploymentSucceeded(null, { ...receipt("a"), attemptId: "../../outside" }));
  assert.throws(() => rollbackTarget({ current: receipt("a"), previous: { ...receipt("b"), attemptId: "../outside" }, lastAttempt: { status: "succeeded" } }));
});
