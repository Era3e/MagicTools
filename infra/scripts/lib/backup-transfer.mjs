import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { acquireStore, canonicalDirectory, hash, parseJson, privateFile, validateBackup, within, writeJson } from "./backup-store.mjs";
import { verifyBackupManifest } from "./backup-crypto.mjs";
import { pruneLockedStore, readOwnedBackup, validateRetentionCount, verifyBackupFiles } from "./backup-retention.mjs";

function transferIdentity(id) { if (!/^[a-f0-9]{16}$/.test(id ?? "")) throw new Error("传输身份无效"); }
function sourceCreation(store, backupId) {
  const report = parseJson(join(store, "attempt-" + backupId + ".json"), "源备份回执");
  if (report.schema !== "magictools-backup-attempt/1" || report.operation !== "create" || report.operationId !== backupId ||
    report.backupId !== backupId || report.success !== true || report.stage !== "complete") throw new Error("源备份创建回执不完整");
  return { operation: "create", operationId: backupId, backupId, success: true, stage: "complete" };
}

// 导出独立密文快照时一直持有源store锁，之后的保留清理不能改变导出副本。
export async function exportBackup({ backupDirectory, keyFile, directory, transferId }) {
  transferIdentity(transferId); let key; let lease;
  try {
    const source = realpathSync(backupDirectory); const destination = canonicalDirectory(directory);
    if (existsSync(destination)) throw new Error("导出目标已存在");
    if (within(dirname(source), destination)) throw new Error("导出目录必须独立于源备份目录");
    key = privateFile(keyFile, dirname(source), 32).bytes;
    privateFile(keyFile, destination, 32);
    const manifest = validateBackup(verifyBackupManifest(parseJson(join(source, "backup.json"), "源备份清单"), key));
    if (basename(source) !== "backup-" + manifest.backupId) throw new Error("源备份目录身份不符");
    lease = acquireStore(dirname(source), { storeId: manifest.storeId, keyId: hash(key), systemIdentifier: manifest.source.systemIdentifier }, transferId);
    readOwnedBackup(lease, source, manifest.backupId, key);
    const creation = sourceCreation(lease.root, manifest.backupId);
    mkdirSync(destination, { mode: 0o700 });
    const output = join(destination, "backup-" + manifest.backupId); mkdirSync(output, { mode: 0o700 });
    for (const name of ["backup.json", ...manifest.files.map((file) => file.fileName + ".enc")]) {
      lease.assertOwned(); copyFileSync(join(source, name), join(output, name), constants.COPYFILE_EXCL);
    }
    const copied = readOwnedBackup(lease, output, manifest.backupId, key);
    await verifyBackupFiles(output, copied); lease.assertOwned();
    const result = { schema: "magictools-backup-export/1", success: true, transferId, backupId: manifest.backupId,
      manifestSha256: hash(readFileSync(join(output, "backup.json"))), sourceCreate: creation, completedAt: new Date().toISOString() };
    writeJson(join(destination, "transfer.json"), result);
    return result;
  } finally { try { lease?.release(); } finally { key?.fill(0); } }
}

export async function cleanupBackupExport({ directory, keyFile, transferId }) {
  transferIdentity(transferId); const root = resolve(directory); let key;
  if (lstatSync(root).isSymbolicLink() || realpathSync(root) !== root || !lstatSync(root).isDirectory()) throw new Error("导出目录身份变化");
  try {
    const receiptFile = join(root, "transfer.json");
    if (!lstatSync(receiptFile).isFile() || lstatSync(receiptFile).isSymbolicLink()) throw new Error("导出回执身份无效");
    const receipt = parseJson(receiptFile, "导出回执");
    if (receipt.schema !== "magictools-backup-export/1" || receipt.success !== true || receipt.transferId !== transferId || !/^[a-f0-9]{16}$/.test(receipt.backupId)) throw new Error("导出身份不匹配");
    const backup = join(root, "backup-" + receipt.backupId);
    if (JSON.stringify(readdirSync(root).sort()) !== JSON.stringify(["backup-" + receipt.backupId, "transfer.json"])) throw new Error("导出目录含其他文件");
    key = privateFile(keyFile, root, 32).bytes;
    const signed = parseJson(join(backup, "backup.json"), "导出备份清单");
    const manifest = validateBackup(verifyBackupManifest(signed, key));
    const lease = { store: { storeId: manifest.storeId, systemIdentifier: manifest.source.systemIdentifier } };
    readOwnedBackup(lease, backup, receipt.backupId, key);
    if (hash(readFileSync(join(backup, "backup.json"))) !== receipt.manifestSha256) throw new Error("导出清单摘要不符");
    await verifyBackupFiles(backup, manifest);
    if (JSON.stringify(readdirSync(root).sort()) !== JSON.stringify(["backup-" + receipt.backupId, "transfer.json"])) throw new Error("导出目录含其他文件");
    readOwnedBackup(lease, backup, receipt.backupId, key);
    for (const file of manifest.files) unlinkSync(join(backup, file.fileName + ".enc"));
    unlinkSync(join(backup, "backup.json")); rmdirSync(backup); unlinkSync(receiptFile); rmdirSync(root);
    return { success: true, transferId, backupId: receipt.backupId, cleanup: "passed" };
  } finally { key?.fill(0); }
}

export async function receiveBackupExport(options, dependencies = {}) {
  const { transfer, manifestBytes, keyFile, downloadFile } = options;
  transferIdentity(transfer?.transferId); const keep = options.keep ?? 15; validateRetentionCount(keep);
  let key; let lease; let stage = "ssh-download"; let backupId; let copy;
  try {
    if (transfer.schema !== "magictools-backup-export/1" || transfer.success !== true || !/^[a-f0-9]{16}$/.test(transfer.backupId) ||
      transfer.sourceCreate?.operation !== "create" || transfer.sourceCreate?.operationId !== transfer.backupId || transfer.sourceCreate?.backupId !== transfer.backupId ||
      transfer.sourceCreate?.success !== true || transfer.sourceCreate?.stage !== "complete" || !Buffer.isBuffer(manifestBytes) || hash(manifestBytes) !== transfer.manifestSha256) throw new Error("远端导出回执与清单不一致");
    const root = canonicalDirectory(options.directory);
    key = privateFile(keyFile, root, 32).bytes;
    let signed; try { signed = JSON.parse(manifestBytes.toString("utf8")); } catch { throw new Error("传输清单JSON无效"); }
    const manifest = validateBackup(verifyBackupManifest(signed, key));
    if (manifest.backupId !== transfer.backupId) throw new Error("传输备份身份不符");
    backupId = manifest.backupId;
    lease = acquireStore(root, { storeId: manifest.storeId, keyId: hash(key), systemIdentifier: manifest.source.systemIdentifier }, transfer.transferId, true);
    const destination = join(lease.root, "backup-" + backupId);
    if (existsSync(destination)) throw new Error("下载目标备份已存在，拒绝覆盖");
    const staging = join(lease.root, ".incoming-" + transfer.transferId); mkdirSync(staging, { mode: 0o700 });
    writeJson(join(staging, ".magictools-backups.json"), lease.store);
    const incoming = join(staging, "backup-" + backupId); mkdirSync(incoming, { mode: 0o700 });
    writeFileSync(join(incoming, "backup.json"), manifestBytes, { flag: "wx", mode: 0o600 });
    for (const file of manifest.files) { await downloadFile(file.fileName + ".enc", join(incoming, file.fileName + ".enc")); lease.assertOwned(); }
    readOwnedBackup(lease, incoming, backupId, key);
    await verifyBackupFiles(incoming, manifest); lease.assertOwned();
    stage = "ssh-verify";
    const verify = dependencies.verify ?? (await import("./backup-local.mjs")).verifyBackup;
    const verification = await verify({ backupDirectory: incoming, keyFile });
    if (verification.backupId !== backupId || verification.catalogVerified !== true || verification.cleanup !== "passed" || !/^[a-f0-9]{16}$/.test(verification.operationId)) throw new Error("下载副本未完成原生恢复校验");
    lease.assertOwned(); readOwnedBackup(lease, incoming, backupId, key);
    await verifyBackupFiles(incoming, manifest); lease.assertOwned();
    if (hash(readFileSync(join(incoming, "backup.json"))) !== transfer.manifestSha256) throw new Error("恢复校验后清单字节发生变化");
    if (existsSync(destination)) throw new Error("下载目标备份已存在，拒绝覆盖");
    renameSync(incoming, destination);
    const result = { schema: "magictools-backup-copy/1", success: true, operationId: transfer.transferId, backupId, directory: destination,
      sourceCompletedAt: manifest.completedAt, recoveryPointLowerBoundAt: manifest.recoveryPointLowerBoundAt,
      verifiedAt: new Date().toISOString(), verificationOperationId: verification.operationId, catalogVerified: true };
    stage = "receipt";
    try { writeJson(join(lease.root, "copy-" + transfer.transferId + ".json"), result); }
    catch (error) {
      // 副本回执未提交时，撤回本轮发布；不留下无法追踪且阻塞重试的正式目录。
      lease.assertOwned(); readOwnedBackup(lease, destination, backupId, key);
      renameSync(destination, incoming); throw error;
    }
    copy = result;
    stage = "cleanup";
    const verificationReceipt = "attempt-" + verification.operationId + ".json";
    if (existsSync(join(staging, verificationReceipt))) {
      copyFileSync(join(staging, verificationReceipt), join(lease.root, verificationReceipt), constants.COPYFILE_EXCL);
      unlinkSync(join(staging, verificationReceipt));
    }
    unlinkSync(join(staging, ".magictools-backups.json")); rmdirSync(staging);
    stage = "retention";
    const retention = await pruneLockedStore(lease, key, { keep, operationId: transfer.transferId, protectedBackupId: backupId });
    return { ...result, retention };
  } catch (error) { error.stage ??= stage; error.operationId = transfer.transferId; error.backupId = backupId; error.copy = copy; throw error; }
  finally {
    try { lease?.release(); }
    catch (error) { error.stage = "unlock"; error.operationId = transfer.transferId; error.backupId = backupId; error.copy = copy; throw error; }
    finally { key?.fill(0); }
  }
}
