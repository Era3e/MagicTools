import { randomBytes, createHash } from "node:crypto";
import { createReadStream, existsSync, lstatSync, readdirSync, realpathSync, renameSync, rmdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { acquireStore, canonicalDirectory, hash, parseJson, privateFile, validateBackup, writeJson } from "./backup-store.mjs";
import { verifyBackupManifest } from "./backup-crypto.mjs";

export function validateRetentionCount(keep) {
  if (!Number.isSafeInteger(keep) || keep < 1) throw new Error("保留份数必须是正整数");
}

export function readOwnedBackup(lease, directory, backupId, key) {
  if (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory() || realpathSync(directory) !== directory) throw new Error("目录不是直接拥有的备份目录");
  const names = readdirSync(directory).sort();
  if (JSON.stringify(names) !== JSON.stringify(["backup.json", "backup_manifest.enc", "base.tar.enc", "pg_wal.tar.enc"])) throw new Error("备份包含缺失或其他文件");
  for (const name of names) {
    const stat = lstatSync(join(directory, name));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("备份成员不是普通文件");
  }
  const manifest = validateBackup(verifyBackupManifest(parseJson(join(directory, "backup.json"), "备份清单"), key));
  if (manifest.backupId !== backupId || manifest.storeId !== lease.store.storeId || manifest.source.systemIdentifier !== lease.store.systemIdentifier ||
    !Number.isFinite(Date.parse(manifest.completedAt)) || ["checksumAndWal", "isolatedDatabaseStartup", "catalog"].some((field) => manifest.verification?.[field] !== "passed")) throw new Error("备份来源或完成验证状态不符");
  for (const file of manifest.files) if (lstatSync(join(directory, file.fileName + ".enc")).size !== file.encryptedBytes) throw new Error("备份文件大小不符");
  return manifest;
}

export async function verifyBackupFiles(directory, manifest) {
  for (const file of manifest.files) {
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(join(directory, file.fileName + ".enc"))) digest.update(chunk);
    if (digest.digest("hex") !== file.sha256) throw new Error("备份密文摘要不一致，停止清理并保留供检查");
  }
}

export async function pruneLockedStore(lease, key, { keep = 15, operationId, protectedBackupId } = {}) {
  validateRetentionCount(keep);
  if (!/^[a-f0-9]{16}$/.test(operationId) || parseJson(join(lease.root, ".lock/owner.json"), "备份锁").operationId !== operationId) throw new Error("保留处理必须持有同一备份目录锁");
  lease.assertOwned();
  const candidates = []; const skipped = [];
  for (const name of readdirSync(lease.root)) {
    if (!/^backup-[a-f0-9]{16}$/.test(name)) continue;
    const directory = join(lease.root, name);
    try { candidates.push({ directory, manifest: readOwnedBackup(lease, directory, name.slice(7), key) }); }
    catch { skipped.push({ name, reason: "not-confirmed-tool-backup" }); }
  }
  if (protectedBackupId !== undefined && !candidates.some((item) => item.manifest.backupId === protectedBackupId)) throw new Error("本次创建的备份未通过保留预检");
  candidates.sort((a, b) => Number(a.manifest.backupId === protectedBackupId) - Number(b.manifest.backupId === protectedBackupId) ||
    Date.parse(a.manifest.completedAt) - Date.parse(b.manifest.completedAt) || a.manifest.backupId.localeCompare(b.manifest.backupId));
  const expired = candidates.slice(0, Math.max(0, candidates.length - keep));
  // 只有需要删除时才重读全部候选；必须先确认留下的副本完好，才能删除旧副本。
  if (expired.length) for (const item of candidates) {
    await verifyBackupFiles(item.directory, item.manifest);
    lease.assertOwned();
  }
  const removed = [];
  for (const item of expired) {
    lease.assertOwned();
    readOwnedBackup(lease, item.directory, item.manifest.backupId, key);
    const quarantine = join(lease.root, ".pruning-" + item.manifest.backupId + "-" + operationId);
    if (existsSync(quarantine)) throw new Error("清理隔离目录已存在");
    lease.assertOwned();
    renameSync(item.directory, quarantine);
    readOwnedBackup(lease, quarantine, item.manifest.backupId, key);
    for (const file of item.manifest.files) { lease.assertOwned(); unlinkSync(join(quarantine, file.fileName + ".enc")); }
    lease.assertOwned(); unlinkSync(join(quarantine, "backup.json"));
    lease.assertOwned(); rmdirSync(quarantine);
    removed.push(item.manifest.backupId);
  }
  return { keep, removed, kept: candidates.slice(expired.length).map((item) => item.manifest.backupId), skipped };
}

export async function pruneBackups({ directory, keyFile, keep = 15 }) {
  validateRetentionCount(keep);
  const operationId = randomBytes(8).toString("hex"); let lease; let key; let result;
  const report = { schema: "magictools-backup-attempt/1", operationId, operation: "prune", stage: "preflight", success: false, startedAt: new Date().toISOString() };
  try {
    const root = canonicalDirectory(directory); key = privateFile(keyFile, root, 32).bytes;
    if (key.length !== 32) throw new Error("备份密钥必须为32字节");
    lease = acquireStore(root, { keyId: hash(key) }, operationId);
    report.stage = "retention";
    result = await pruneLockedStore(lease, key, { keep, operationId });
    report.success = true; report.stage = "complete";
  } catch (error) { report.error = error.message; error.operationId = operationId; error.stage = report.stage; throw error; }
  finally {
    let failure;
    try { lease?.release(); } catch (error) { failure = error; report.success = false; report.stage = "unlock"; report.error = error.message; }
    report.finishedAt = new Date().toISOString();
    try { if (lease) writeJson(join(lease.root, "attempt-" + operationId + ".json"), { ...report, result }); }
    catch (error) { failure ??= error; report.stage = "receipt"; }
    finally { key?.fill(0); }
    if (failure) { failure.operationId = operationId; failure.stage = report.stage; throw failure; }
  }
  return { operationId, ...result };
}
