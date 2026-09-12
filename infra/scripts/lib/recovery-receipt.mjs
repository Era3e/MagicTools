import { digestBytes, validateRestoredBinding } from "./release-artifacts.mjs";
import { recoveryConnectionFields } from "./recovery-connections.mjs";

const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const time = (value) => {
  const parts = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/);
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day] = parts.map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
};
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const sameFields = (value, expected) => record(value) && Object.keys(value).length === Object.keys(expected).length &&
  Object.entries(expected).every(([key, item]) => value[key] === item);

// SSH只从已校验的制品/配置建立预期；当前目录允许被应用迁移改变，首次目录证明必须保持。
export function assertRecoveryReceipt(receipt, config, catalog) {
  if (config.schema !== "magictools-deployment-config/2") return {};
  const binding = validateRestoredBinding(config.database);
  const databases = catalog.filter((item) => item.kind === "node" && item.app !== "gateway").map((item) => item.app).sort();
  if (JSON.stringify(binding.databases) !== JSON.stringify(databases) || catalog.some((item) =>
    binding.container.name === item.service || binding.container.name === config.project + "-" + item.service + "-1")) throw new Error("恢复数据库回执的配置与应用库及名称契约不一致");
  const bindingHash = digestBytes(JSON.stringify(binding));
  const database = receipt.database, claim = receipt.databaseClaim, initial = receipt.databaseInitialVerification;
  if (!record(database) || database.bindingHash !== bindingHash || database.restoreOperationId !== binding.restoreOperationId || database.backupId !== binding.backupId ||
    !sameFields(database.container, binding.container) || !sameFields(database.network, binding.network) || !sameFields(database.volume, binding.volume) ||
    database.systemIdentifier !== binding.source.systemIdentifier || database.serverVersion !== binding.source.serverVersion ||
    !Array.isArray(database.databases) || JSON.stringify([...database.databases].sort()) !== JSON.stringify(binding.databases) ||
    !hash(database.catalogSha256) || database.initialCatalogMatched !== null || database.running !== true || database.internalNetwork !== true) throw new Error("恢复数据库回执与配置绑定不一致");
  if (!record(initial) || !time(initial.verifiedAt) || initial.catalogSha256 !== binding.catalogSha256 ||
    !time(receipt.finishedAt) || Date.parse(initial.verifiedAt) < Date.parse(binding.restoredAt) ||
    Date.parse(initial.verifiedAt) > Date.parse(receipt.finishedAt)) throw new Error("恢复数据库回执缺少有效首次验证");
  if (!record(claim) || claim.name !== "mt-recovery-" + binding.restoreOperationId + "-claim" || !hash(claim.id) || !hash(claim.owner) ||
    claim.project !== config.project || claim.bindingHash !== bindingHash || typeof claim.reused !== "boolean") throw new Error("恢复数据库归属回执与配置绑定不一致");
  const expected = recoveryConnectionFields(catalog).map((field) => ({ ...field, host: binding.container.name, port: 5432 }));
  const connections = receipt.databaseConnections;
  if (!Array.isArray(connections) || connections.length !== expected.length || expected.some((item) => connections.filter((value) => sameFields(value, item)).length !== 1)) throw new Error("恢复数据库连接回执缺失、重复或目标不符");
  // 只发布验证过的公开字段，不透传远端扩展字段或连接原文。
  return {
    database: { bindingHash, restoreOperationId: binding.restoreOperationId, backupId: binding.backupId,
      container: { ...binding.container }, network: { ...binding.network }, volume: { ...binding.volume },
      systemIdentifier: binding.source.systemIdentifier, serverVersion: binding.source.serverVersion, databases: [...binding.databases],
      catalogSha256: database.catalogSha256, initialCatalogMatched: null, running: true, internalNetwork: true },
    databaseClaim: { name: claim.name, id: claim.id, owner: claim.owner, project: config.project, bindingHash, reused: claim.reused },
    databaseInitialVerification: { verifiedAt: initial.verifiedAt, catalogSha256: binding.catalogSha256 }, databaseConnections: expected,
  };
}
