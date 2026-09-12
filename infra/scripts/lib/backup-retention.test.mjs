import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { acquireStore, hash } from "./backup-store.mjs";
import { encryptBackupStream, signBackupManifest } from "./backup-crypto.mjs";
import { pruneBackups } from "./backup-retention.mjs";

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "mt-backup-retention-"));
  t.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + "mt-backup-retention-"));
    assert.equal(lstatSync(directory).isSymbolicLink(), false); rmSync(directory, { recursive: true });
  });
  const key = randomBytes(32); const keyFile = join(directory, "private.backup-key"); writeFileSync(keyFile, key);
  const store = join(directory, "store"); const lease = acquireStore(store, { keyId: hash(key), systemIdentifier: "1234567890123456" }, "f".repeat(16), true);
  const storeId = lease.store.storeId; lease.release();
  return { directory, store, storeId, keyFile, key };
}

// 本测试使用真实文件和认证加密，PG负载是保留策略夹具；不冒充原生恢复验证。
async function backup(context, index) {
  const backupId = index.toString(16).padStart(16, "0"); const directory = join(context.store, "backup-" + backupId); mkdirSync(directory);
  const files = [];
  for (const fileName of ["base.tar", "pg_wal.tar", "backup_manifest"]) files.push(await encryptBackupStream(Readable.from([Buffer.from("fixture:" + index + ":" + fileName)]),
    createWriteStream(join(directory, fileName + ".enc")), { key: context.key, backupId, fileName }));
  const manifest = { schema: "magictools-backup/1", backupId, storeId: context.storeId, status: "complete",
    source: { systemIdentifier: "1234567890123456", serverVersion: 160015, dataDirectory: "/pg/data", image: { platform: "linux/amd64", reference: "pgvector/pgvector@sha256:" + "a".repeat(64) } },
    files, databases: ["manager"], catalogSha256: "b".repeat(64), walRanges: [{ Timeline: 1, "Start-LSN": "0/1", "End-LSN": "0/2" }],
    startedAt: new Date(Date.UTC(2026, 8, 12, 0, index)).toISOString(), completedAt: new Date(Date.UTC(2026, 8, 12, 0, index, 1)).toISOString(),
    verification: { checksumAndWal: "passed", isolatedDatabaseStartup: "passed", catalog: "passed" } };
  writeFileSync(join(directory, "backup.json"), JSON.stringify(signBackupManifest(manifest, context.key)));
  return { directory, backupId, manifest };
}

test("默认只保留最近15份完整备份，备份目录内的其他文件不被删除", async (t) => {
  const context = fixture(t); const backups = [];
  for (let index = 1; index <= 18; index++) backups.push(await backup(context, index));
  writeFileSync(join(context.store, "user-notes.txt"), "keep my notes");
  const result = await pruneBackups({ directory: context.store, keyFile: context.keyFile });
  assert.deepEqual(result.removed, backups.slice(0, 3).map((value) => value.backupId));
  assert.equal(readdirSync(context.store).filter((name) => name.startsWith("backup-")).length, 15);
  assert.equal(readFileSync(join(context.store, "user-notes.txt"), "utf8"), "keep my notes");
  assert.ok(!existsSync(join(context.store, ".lock")));
});

test("活跃目录锁、无效保留份数及错误密钥不能触发清理", async (t) => {
  const context = fixture(t); const item = await backup(context, 1);
  const lease = acquireStore(context.store, { keyId: hash(context.key) }, "e".repeat(16));
  try { await assert.rejects(pruneBackups({ directory: context.store, keyFile: context.keyFile, keep: 1 }), /锁/); }
  finally { lease.release(); }
  for (const keep of [0, -1, 1.5, NaN, null]) await assert.rejects(pruneBackups({ directory: context.store, keyFile: context.keyFile, keep }), /正整数/);
  const wrong = join(context.directory, "wrong.key"); writeFileSync(wrong, randomBytes(32));
  await assert.rejects(pruneBackups({ directory: context.store, keyFile: wrong }), /来源或密钥/);
  assert.ok(existsSync(item.directory));
});

test("含额外文件、链接或未认证清单的目录不会被当成可删除备份", async (t) => {
  const context = fixture(t);
  const extra = await backup(context, 1); writeFileSync(join(extra.directory, "user-notes.txt"), "important");
  const unverified = await backup(context, 2); writeFileSync(join(unverified.directory, "backup.json"), "{}");
  const outside = join(context.directory, "outside"); mkdirSync(outside); writeFileSync(join(outside, "keep.txt"), "keep");
  const alias = join(context.store, "backup-" + "a".repeat(16)); fs.symlinkSync(outside, alias, "junction");
  const old = await backup(context, 3); const newest = await backup(context, 4);
  const result = await pruneBackups({ directory: context.store, keyFile: context.keyFile, keep: 1 });
  assert.deepEqual(result.removed, [old.backupId]); assert.equal(result.skipped.length, 3);
  for (const directory of [extra.directory, unverified.directory, newest.directory, outside]) assert.ok(existsSync(directory));
  assert.equal(readFileSync(join(outside, "keep.txt"), "utf8"), "keep");
});

test("旧备份密文被等长篡改时失败，不能在校验失败前删掉其他备份", async (t) => {
  const context = fixture(t); const first = await backup(context, 1); const second = await backup(context, 2); const latest = await backup(context, 3);
  const file = join(second.directory, "base.tar.enc"); const data = readFileSync(file); data[0] ^= 1; writeFileSync(file, data);
  await assert.rejects(pruneBackups({ directory: context.store, keyFile: context.keyFile, keep: 1 }), /摘要不一致/);
  for (const item of [first, second, latest]) assert.ok(existsSync(item.directory));
  assert.ok(!existsSync(join(context.store, ".lock")));
});

test("保留集合密文损坏时不删除任何旧备份", async (t) => {
  const context = fixture(t); const old = await backup(context, 1); const latest = await backup(context, 2);
  const file = join(latest.directory, "base.tar.enc"); const bytes = readFileSync(file); bytes[0] ^= 1; writeFileSync(file, bytes);
  await assert.rejects(pruneBackups({ directory: context.store, keyFile: context.keyFile, keep: 1 }), /摘要不一致/);
  assert.ok(existsSync(old.directory)); assert.ok(existsSync(latest.directory));
});

test("异步校验期间锁归属变化时必须停止删除并留下新锁", async (t) => {
  const context = fixture(t); const old = await backup(context, 1); await backup(context, 2);
  const original = fs.createReadStream; let changed = false;
  fs.createReadStream = (file, ...args) => {
    if (!changed) { changed = true; writeFileSync(join(context.store, ".lock/owner.json"), JSON.stringify({ operationId: "d".repeat(16) })); }
    return original(file, ...args);
  }; syncBuiltinESMExports();
  try { await assert.rejects(pruneBackups({ directory: context.store, keyFile: context.keyFile, keep: 1 }), /锁/); }
  finally { fs.createReadStream = original; syncBuiltinESMExports(); }
  assert.ok(existsSync(old.directory));
  assert.equal(JSON.parse(readFileSync(join(context.store, ".lock/owner.json"))).operationId, "d".repeat(16));
});

test("删除失败留下隔离目录和失败回执，保留的新备份不受影响", async (t) => {
  const context = fixture(t); const old = await backup(context, 1); const latest = await backup(context, 2);
  const original = fs.unlinkSync;
  fs.unlinkSync = (file) => { if (String(file).includes(".pruning-") && String(file).endsWith("base.tar.enc")) throw new Error("injected retention failure"); return original(file); };
  syncBuiltinESMExports();
  try { await assert.rejects(pruneBackups({ directory: context.store, keyFile: context.keyFile, keep: 1 }), /injected retention failure/); }
  finally { fs.unlinkSync = original; syncBuiltinESMExports(); }
  assert.ok(existsSync(latest.directory)); assert.ok(readdirSync(context.store).some((name) => name.startsWith(".pruning-" + old.backupId)));
  const receipt = JSON.parse(readFileSync(join(context.store, readdirSync(context.store).find((name) => name.startsWith("attempt-"))), "utf8"));
  assert.equal(receipt.success, false); assert.equal(receipt.stage, "retention");
});
