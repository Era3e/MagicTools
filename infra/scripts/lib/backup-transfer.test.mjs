import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { copyFileSync, createWriteStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { acquireStore, hash } from "./backup-store.mjs";
import { encryptBackupStream, signBackupManifest, verifyBackupManifest } from "./backup-crypto.mjs";
import { exportBackup, cleanupBackupExport, receiveBackupExport } from "./backup-transfer.mjs";
import { remoteBackupExport } from "../backup-export.mjs";

async function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "mt-backup-transfer-"));
  t.after(() => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + "mt-backup-transfer-")); assert.equal(lstatSync(root).isSymbolicLink(), false); rmSync(root, { recursive: true }); });
  const key = randomBytes(32); const keyFile = join(root, "private.key"); writeFileSync(keyFile, key);
  const store = join(root, "store"); const id = "1234567890abcdef";
  const lease = acquireStore(store, { keyId: hash(key), systemIdentifier: "1234567890123456" }, id, true); const storeId = lease.store.storeId; lease.release();
  const backupDirectory = join(store, "backup-" + id); mkdirSync(backupDirectory); const files = [];
  for (const fileName of ["base.tar", "pg_wal.tar", "backup_manifest"]) files.push(await encryptBackupStream(Readable.from([Buffer.from("transfer-fixture:" + fileName)]),
    createWriteStream(join(backupDirectory, fileName + ".enc")), { key, backupId: id, fileName }));
  const manifest = { schema: "magictools-backup/1", status: "complete", backupId: id, storeId, files, databases: ["manager"], catalogSha256: "b".repeat(64), walRanges: [{ Timeline: 1 }],
    source: { systemIdentifier: "1234567890123456", serverVersion: 160015, dataDirectory: "/pg/data", image: { platform: "linux/amd64", reference: "pgvector/pgvector@sha256:" + "a".repeat(64) } },
    completedAt: new Date().toISOString(), verification: { checksumAndWal: "passed", isolatedDatabaseStartup: "passed", catalog: "passed" } };
  writeFileSync(join(backupDirectory, "backup.json"), JSON.stringify(signBackupManifest(manifest, key)));
  writeFileSync(join(store, "attempt-" + id + ".json"), JSON.stringify({ schema: "magictools-backup-attempt/1", operation: "create", operationId: id, backupId: id, success: true, stage: "complete" }));
  return { root, key, keyFile, store, backupDirectory, manifest, transferId: "e".repeat(16), directory: join(root, "export") };
}

test("导出在源锁内复制完整认证密文，清理只删除该导出副本", async (t) => {
  const context = await fixture(t); const result = await exportBackup(context);
  assert.equal(result.success, true); assert.equal(result.transferId, context.transferId);
  const exported = join(context.directory, "backup-" + result.backupId);
  const manifest = verifyBackupManifest(JSON.parse(readFileSync(join(exported, "backup.json"))), context.key);
  for (const file of manifest.files) assert.equal(hash(readFileSync(join(exported, file.fileName + ".enc"))), file.sha256);
  assert.equal(existsSync(join(context.store, ".lock")), false);
  await cleanupBackupExport(context);
  assert.equal(existsSync(context.directory), false); assert.ok(existsSync(context.backupDirectory));
});

test("导出拒绝活跃锁、已有目标、额外文件与密文篡改", async (t) => {
  const context = await fixture(t);
  const lease = acquireStore(context.store, { keyId: hash(context.key) }, "d".repeat(16));
  try { await assert.rejects(exportBackup(context), /锁/); } finally { lease.release(); }
  writeFileSync(join(context.backupDirectory, "notes"), "user data");
  await assert.rejects(exportBackup(context), /其他文件/);
  assert.equal(readFileSync(join(context.backupDirectory, "notes"), "utf8"), "user data");
  const valid = await fixture(t); await exportBackup(valid);
  await assert.rejects(exportBackup(valid), /存在/);
  const damaged = await fixture(t); const file = join(damaged.backupDirectory, "base.tar.enc");
  const data = readFileSync(file); data[0] ^= 1; writeFileSync(file, data);
  await assert.rejects(exportBackup(damaged), /摘要/);
  assert.equal(existsSync(join(damaged.directory, "transfer.json")), false);
});

test("导出清理遇到额外文件或错误身份不删除用户内容", async (t) => {
  const context = await fixture(t); await exportBackup(context);
  await assert.rejects(cleanupBackupExport({ ...context, transferId: "f".repeat(16) }), /身份/);
  writeFileSync(join(context.directory, "notes"), "keep");
  await assert.rejects(cleanupBackupExport(context), /其他文件/);
  assert.equal(readFileSync(join(context.directory, "notes"), "utf8"), "keep");
  assert.equal(readdirSync(context.directory).length, 3);
});

test("远端清理失败的持久事件准确标记ssh-cleanup阶段", async (t) => {
  const context = await fixture(t); await exportBackup(context);
  writeFileSync(join(context.directory, "notes"), "keep"); const events = join(context.root, "events");
  await assert.rejects(remoteBackupExport(["cleanup", "--export-dir", context.directory, "--transfer-id", context.transferId,
    "--key-file", context.keyFile, "--events-dir", events]), /其他文件/);
  const event = JSON.parse(readFileSync(join(events, readdirSync(events).find((name) => name.endsWith(".event.json")))));
  assert.equal(event.stage, "ssh-cleanup"); assert.equal(event.operationId, context.transferId);
});

test("下载完整且隔离恢复确认后才发布副本，已存在目录不覆盖", async (t) => {
  const context = await fixture(t); const transfer = await exportBackup(context); const remote = join(context.directory, "backup-" + transfer.backupId);
  let verified = false; const destination = join(context.root, "destination");
  const options = { directory: destination, keyFile: context.keyFile, transfer, manifestBytes: readFileSync(join(remote, "backup.json")),
    downloadFile: async (name, output) => { copyFileSync(join(remote, name), output); } };
  const verify = async ({ backupDirectory }) => {
    verified = true; assert.equal(existsSync(join(destination, "backup-" + transfer.backupId)), false);
    for (const file of context.manifest.files) assert.equal(hash(readFileSync(join(backupDirectory, file.fileName + ".enc"))), file.sha256);
    return { operationId: "c".repeat(16), backupId: transfer.backupId, catalogVerified: true, cleanup: "passed" };
  };
  const result = await receiveBackupExport(options, { verify });
  assert.equal(verified, true); assert.ok(existsSync(result.directory)); assert.equal(result.catalogVerified, true);
  assert.equal(existsSync(join(destination, ".lock")), false);
  await assert.rejects(receiveBackupExport(options, { verify }), /存在/);
});

test("传输中断、完整性失败与恢复失败都不能发布成功副本", async (t) => {
  for (const mode of ["interrupted", "tampered", "restore-failed"]) {
    const context = await fixture(t); const transfer = await exportBackup(context); const remote = join(context.directory, "backup-" + transfer.backupId);
    const destination = join(context.root, "destination");
    await assert.rejects(receiveBackupExport({ directory: destination, keyFile: context.keyFile, transfer, manifestBytes: readFileSync(join(remote, "backup.json")),
      downloadFile: async (name, output) => {
        if (mode === "interrupted") throw new Error("controlled download failure");
        copyFileSync(join(remote, name), output);
        if (mode === "tampered") { const bytes = readFileSync(output); bytes[0] ^= 1; writeFileSync(output, bytes); }
      } }, { verify: async () => { throw new Error("controlled restore failure"); } }));
    assert.equal(existsSync(join(destination, "backup-" + transfer.backupId)), false);
    assert.equal(existsSync(join(destination, ".lock")), false); assert.ok(existsSync(context.backupDirectory));
  }
});

test("恢复确认后密文变化或副本回执落盘失败，都不能留下成功发布目录", async (t) => {
  for (const mode of ["changed-after-verification", "receipt-failed"]) {
    const context = await fixture(t); const transfer = await exportBackup(context); const remote = join(context.directory, "backup-" + transfer.backupId);
    const destination = join(context.root, "destination"); const original = fs.writeFileSync;
    if (mode === "receipt-failed") {
      fs.writeFileSync = (file, ...args) => { if (String(file).includes("copy-")) throw new Error("injected copy receipt ENOSPC"); return original(file, ...args); };
      syncBuiltinESMExports();
    }
    try {
      await assert.rejects(receiveBackupExport({ directory: destination, keyFile: context.keyFile, transfer, manifestBytes: readFileSync(join(remote, "backup.json")),
        downloadFile: async (name, output) => copyFileSync(join(remote, name), output) }, { verify: async ({ backupDirectory }) => {
        if (mode === "changed-after-verification") { const file = join(backupDirectory, "base.tar.enc"); const bytes = readFileSync(file); bytes[0] ^= 1; writeFileSync(file, bytes); }
        return { operationId: "c".repeat(16), backupId: transfer.backupId, catalogVerified: true, cleanup: "passed" };
      } }));
    } finally { fs.writeFileSync = original; syncBuiltinESMExports(); }
    assert.equal(existsSync(join(destination, "backup-" + transfer.backupId)), false);
    assert.equal(existsSync(join(destination, "copy-" + transfer.transferId + ".json")), false);
    assert.ok(existsSync(context.backupDirectory));
  }
});
