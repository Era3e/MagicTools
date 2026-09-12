import { randomBytes } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { digestBytes, validateRestoredBinding } from "./release-artifacts.mjs";

function context(input) {
  const root = realpathSync(input.stateDirectory); const binding = validateRestoredBinding(input.binding);
  if (input.owner !== digestBytes(root) || typeof input.project !== "string" || !/^[a-z][a-z0-9-]{2,48}$/.test(input.project) || typeof input.attemptId !== "string" || !/^[a-f0-9]{16}$/.test(input.attemptId)) throw new Error("恢复部署状态归属无效");
  const assertLock = () => {
    const directory = join(root, "deploy.lock"); const file = join(directory, "owner.json");
    let owner;
    try {
      if (lstatSync(directory).isSymbolicLink() || lstatSync(file).isSymbolicLink()) throw new Error();
      owner = JSON.parse(readFileSync(file, "utf8"));
    } catch { throw new Error("恢复部署必须持有状态目录锁"); }
    if (owner.attemptId !== input.attemptId) throw new Error("恢复部署状态目录锁归属变化");
  };
  assertLock();
  return { ...input, binding, root, file: join(root, "recovery-binding.json"), bindingHash: digestBytes(JSON.stringify(binding)), assertLock };
}

function load(selected) {
  if (!existsSync(selected.file)) return null;
  let value;
  try {
    if (lstatSync(selected.file).isSymbolicLink() || !lstatSync(selected.file).isFile() || lstatSync(selected.file).size > 16384) throw new Error();
    value = JSON.parse(readFileSync(selected.file, "utf8"));
  } catch { throw new Error("恢复部署归属记录无法确认"); }
  if (value.schema !== "magictools-recovery-attachment/1" || value.owner !== selected.owner || value.project !== selected.project || value.bindingHash !== selected.bindingHash ||
    !["reserved", "initial-verified"].includes(value.phase) || (value.claim !== null && !validStoredClaim(value.claim, selected)) ||
    (value.phase === "reserved" && value.initialVerifiedAt !== null) ||
    (value.phase === "initial-verified" && (!value.claim || typeof value.initialVerifiedAt !== "string" || !Number.isFinite(Date.parse(value.initialVerifiedAt))))) throw new Error("部署目录不能更换恢复数据库绑定或使用损坏声明");
  return value;
}

function validStoredClaim(claim, selected) {
  return claim && typeof claim === "object" && !Array.isArray(claim) && Object.keys(claim).length === 2 &&
    claim.name === "mt-recovery-" + selected.binding.restoreOperationId + "-claim" && typeof claim.id === "string" && /^[a-f0-9]{64}$/.test(claim.id);
}

function save(selected, value) {
  selected.assertLock();
  const temporary = selected.file + "." + randomBytes(8).toString("hex") + ".tmp";
  try {
    writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    selected.assertLock(); renameSync(temporary, selected.file);
  } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  return value;
}

export function reserveRecoveryAttachment(input) {
  const selected = context(input); const existing = load(selected);
  if (existing) return existing;
  if (input.previousState?.current || input.previousState?.previous || ["containers", "networks", "volumes"].some((kind) => !Array.isArray(input.resources?.[kind]) || input.resources[kind].length)) throw new Error("首次恢复交接必须使用全新项目与没有成功历史的状态目录");
  return save(selected, { schema: "magictools-recovery-attachment/1", phase: "reserved", owner: selected.owner, project: selected.project,
    bindingHash: selected.bindingHash, claim: null, initialVerifiedAt: null, createdAt: new Date().toISOString() });
}

export function recordRecoveryClaim(input, claim) {
  const selected = context(input); const existing = load(selected);
  if (!existing || claim?.name !== "mt-recovery-" + selected.binding.restoreOperationId + "-claim" || typeof claim.id !== "string" || !/^[a-f0-9]{64}$/.test(claim.id) ||
    claim.owner !== selected.owner || claim.project !== selected.project || claim.bindingHash !== selected.bindingHash ||
    (existing.claim && (existing.claim.id !== claim.id || existing.claim.name !== claim.name))) throw new Error("恢复部署归属声明与记录不符");
  return save(selected, { ...existing, claim: { name: claim.name, id: claim.id } });
}

export function confirmRecoveryInitialValidation(input, facts, claim) {
  const selected = context(input); const existing = load(selected); const binding = selected.binding;
  if (!existing?.claim || !claim || claim.id !== existing.claim.id || claim.name !== existing.claim.name || claim.owner !== selected.owner || claim.project !== selected.project || claim.bindingHash !== selected.bindingHash ||
    facts?.initialCatalogMatched !== true || facts.bindingHash !== selected.bindingHash || facts.catalogSha256 !== binding.catalogSha256 ||
    facts.restoreOperationId !== binding.restoreOperationId || facts.backupId !== binding.backupId || facts.container?.id !== binding.container.id ||
    facts.network?.id !== binding.network.id || facts.volume?.name !== binding.volume.name || facts.systemIdentifier !== binding.source.systemIdentifier ||
    facts.running !== true || facts.internalNetwork !== true) throw new Error("恢复数据库首次目录校验尚未通过");
  if (existing.phase === "initial-verified") return existing;
  return save(selected, { ...existing, phase: "initial-verified", initialVerifiedAt: new Date().toISOString() });
}
