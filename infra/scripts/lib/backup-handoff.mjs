import { randomBytes } from "node:crypto";
import { existsSync, linkSync, mkdirSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { acquireStore, canonicalDirectory, hash, parseJson, privateFile, validateBackup, within, writeJson } from "./backup-store.mjs";
import { readOwnedBackup, verifyBackupFiles } from "./backup-retention.mjs";
import { verifyBackupManifest } from "./backup-crypto.mjs";
import { captureRestoredBinding } from "./recovery-database.mjs";
import { digestBytes, validateDeploymentConfig } from "./release-artifacts.mjs";

export async function prepareRecoveryHandoff(options, dependencies = {}) {
  const operationId = randomBytes(8).toString("hex"); let key; let lease; let temporary; let result;
  const report = { schema: "magictools-backup-attempt/1", operation: "handoff", operationId, stage: "preflight", success: false, startedAt: new Date().toISOString() };
  try {
    const output = canonicalDirectory(options.outputFile);
    if (existsSync(output)) throw new Error("交接配置输出已存在，拒绝覆盖");
    const directory = realpathSync(options.backupDirectory);
    if (within(dirname(directory), output)) throw new Error("交接配置输出必须独立于源备份目录");
    const manifestBytes = readFileSync(join(directory, "backup.json"));
    const privateKey = privateFile(options.keyFile, dirname(directory), 32); key = privateKey.bytes;
    let signed; try { signed = JSON.parse(manifestBytes.toString("utf8")); } catch { throw new Error("备份清单认证JSON无效"); }
    const manifest = validateBackup(verifyBackupManifest(signed, key)); report.backupId = manifest.backupId;
    if (basename(directory) !== "backup-" + manifest.backupId) throw new Error("交接备份目录身份不符");
    lease = acquireStore(dirname(directory), { storeId: manifest.storeId, keyId: hash(key), systemIdentifier: manifest.source.systemIdentifier }, operationId);
    readOwnedBackup(lease, directory, manifest.backupId, key); await verifyBackupFiles(directory, manifest); lease.assertOwned();
    const base = validateDeploymentConfig(parseJson(options.configFile, "交接基线配置")).config;
    if (base.schema !== "magictools-deployment-config/1") throw new Error("交接使用v1基线新建恢复配置，不能替换既有恢复绑定");
    const receiptBytes = readFileSync(options.restoreReceiptFile); let restoreReceipt;
    try { restoreReceipt = JSON.parse(receiptBytes.toString("utf8")); } catch { throw new Error("恢复回执JSON无效"); }
    report.stage = "handoff-verify";
    const binding = await captureRestoredBinding({ manifest, manifestSha256: hash(manifestBytes), restoreReceipt }, dependencies);
    if (options.catalog.some((item) => binding.container.name === item.service || binding.container.name === base.project + "-" + item.service + "-1")) throw new Error("恢复数据库名称与部署应用名称冲突");
    const config = validateDeploymentConfig({ ...base, schema: "magictools-deployment-config/2", database: binding });
    lease.assertOwned();
    readOwnedBackup(lease, directory, manifest.backupId, key);
    await verifyBackupFiles(directory, manifest); lease.assertOwned();
    readOwnedBackup(lease, directory, manifest.backupId, key);
    if (!readFileSync(privateKey.path).equals(key) || !readFileSync(join(directory, "backup.json")).equals(manifestBytes) || !readFileSync(options.restoreReceiptFile).equals(receiptBytes)) throw new Error("交接期间来源文件发生变化");
    report.stage = "handoff-write"; mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
    temporary = output + "." + operationId + ".tmp";
    writeFileSync(temporary, JSON.stringify(config.config, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    // 同目录硬链接原子创建最终路径，已有输出即失败；不让rename覆盖并发写入的文件。
    linkSync(temporary, output); unlinkSync(temporary); temporary = null;
    result = { operationId, backupId: manifest.backupId, restoreOperationId: binding.restoreOperationId, output, configVersion: config.configVersion, bindingHash: digestBytes(JSON.stringify(binding)) };
    report.success = true; report.stage = "complete"; report.result = result;
  } catch (error) { error.operationId = operationId; error.backupId = report.backupId; error.stage = report.stage; report.error = error.message; throw error; }
  finally {
    let failure;
    try { if (temporary && existsSync(temporary)) unlinkSync(temporary); } catch (error) { failure = error; report.stage = "cleanup"; }
    try { lease?.release(); } catch (error) { failure ??= error; report.stage = "unlock"; }
    report.finishedAt = new Date().toISOString(); if (failure) report.success = false;
    try { if (lease) writeJson(join(lease.root, "attempt-" + operationId + ".json"), report); }
    catch (error) { failure ??= error; report.stage = "receipt"; }
    finally { key?.fill(0); }
    if (failure) { failure.operationId = operationId; failure.backupId = report.backupId; failure.stage = report.stage; failure.output = result?.output; throw failure; }
  }
  return result;
}
