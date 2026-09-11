function validatePointer(pointer) {
  if (!pointer || !/^[a-f0-9]{16}$/.test(pointer.attemptId) || !/^[a-z0-9-]{1,120}$/.test(pointer.releaseId) || !/^[a-f0-9]{64}$/.test(pointer.configVersion) || !/^[a-f0-9]{64}$/.test(pointer.manifestSha256)) throw new Error("成功部署记录不完整或路径标识非法");
  return pointer;
}

export function deploymentSucceeded(state, pointer) {
  if (state) validateDeploymentState(state);
  validatePointer(pointer);
  if (state?.current) validatePointer(state.current);
  if (state?.previous) validatePointer(state.previous);
  const sameRelease = state?.current?.releaseId === pointer.releaseId && state?.current?.configVersion === pointer.configVersion && state?.current?.manifestSha256 === pointer.manifestSha256;
  return { schema: "magictools-deployment-state/1", current: pointer, previous: sameRelease ? state?.previous ?? null : state?.current ?? null,
    lastAttempt: { attemptId: pointer.attemptId, status: "succeeded" } };
}

export function deploymentFailed(state, attemptId) {
  if (!/^[a-f0-9]{16}$/.test(attemptId)) throw new Error("部署尝试标识非法");
  return { schema: "magictools-deployment-state/1", current: state?.current ?? null, previous: state?.previous ?? null, lastAttempt: { attemptId, status: "failed" } };
}

export function rollbackTarget(state) {
  if (state) validateDeploymentState(state);
  if (state?.current) validatePointer(state.current);
  if (state?.previous) validatePointer(state.previous);
  const target = state?.lastAttempt?.status === "failed" ? state?.current : state?.previous;
  if (!target) throw new Error("没有可回退的成功部署记录");
  return validatePointer(target);
}

export function validateDeploymentState(state) {
  if (state?.schema !== "magictools-deployment-state/1" || !["succeeded", "failed"].includes(state.lastAttempt?.status) || !/^[a-f0-9]{16}$/.test(state.lastAttempt?.attemptId)) throw new Error("部署状态记录无效");
  if (state.current) validatePointer(state.current);
  if (state.previous) validatePointer(state.previous);
  return state;
}
