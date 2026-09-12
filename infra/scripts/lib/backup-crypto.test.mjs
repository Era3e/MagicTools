import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Readable, Writable } from "node:stream";
import { encryptBackupStream, decryptBackupStream, signBackupManifest, verifyBackupManifest } from "./backup-crypto.mjs";

function collector() {
  const chunks = [];
  return { stream: new Writable({ write(chunk, encoding, done) { chunks.push(Buffer.from(chunk)); done(); } }), bytes: () => Buffer.concat(chunks) };
}
const identity = { backupId: "0123456789abcdef", fileName: "base.tar" };

test("逐文件流式加密且同一密钥重复备份使用独立nonce", async () => {
  const key = randomBytes(32); const plain = Buffer.from("private database contents");
  const first = collector(); const second = collector();
  const a = await encryptBackupStream(Readable.from([plain]), first.stream, { ...identity, key });
  const b = await encryptBackupStream(Readable.from([plain]), second.stream, { ...identity, key });
  assert.notEqual(a.nonce, b.nonce);
  assert.notDeepEqual(first.bytes(), plain);
  assert.notDeepEqual(first.bytes(), second.bytes());
  assert.equal(a.plainBytes, plain.length);
  assert.equal(a.encryptedBytes, first.bytes().length);
  assert.match(a.sha256, /^[a-f0-9]{64}$/);
});

test("原密钥可恢复完整数据，错误密钥、篡改或跨备份替换不能通过认证", async () => {
  const key = randomBytes(32); const plain = Buffer.from("private role and business data"); const encrypted = collector();
  const metadata = await encryptBackupStream(Readable.from([plain]), encrypted.stream, { ...identity, key });
  const restored = collector();
  await decryptBackupStream(Readable.from([encrypted.bytes()]), restored.stream, { ...identity, key, metadata });
  assert.deepEqual(restored.bytes(), plain);
  for (const change of [{ key: randomBytes(32) }, { backupId: "fedcba9876543210" }, { fileName: "pg_wal.tar" }]) {
    await assert.rejects(decryptBackupStream(Readable.from([encrypted.bytes()]), collector().stream, { ...identity, key, metadata, ...change }));
  }
  const damaged = Buffer.from(encrypted.bytes()); damaged[0] ^= 1;
  await assert.rejects(decryptBackupStream(Readable.from([damaged]), collector().stream, { ...identity, key, metadata }));
});

test("文件容量超限和写入失败必须终止，不能返回成功的加密清单", async () => {
  const key = randomBytes(32);
  await assert.rejects(encryptBackupStream(Readable.from([Buffer.from("123"), Buffer.from("456")]), collector().stream,
    { ...identity, key, maxPlaintextBytes: 4 }), /容量/);
  const broken = new Writable({ write(chunk, encoding, done) { done(new Error("destination full")); } });
  await assert.rejects(encryptBackupStream(Readable.from([Buffer.from("123")]), broken, { ...identity, key }), /destination full/);
});

test("完整清单认证保护恢复镜像、系统身份、时间、WAL与密文文件集合", () => {
  const key = randomBytes(32);
  const manifest = { schema: "magictools-backup/1", backupId: identity.backupId,
    source: { image: "pgvector/pgvector@sha256:" + "a".repeat(64), systemIdentifier: "7684397367273599020" },
    completedAt: "2026-09-12T00:00:00Z", walRanges: [{ Timeline: 1, "Start-LSN": "0/4000028", "End-LSN": "0/4000100" }],
    files: [{ fileName: "base.tar", sha256: "b".repeat(64) }] };
  const signed = signBackupManifest(manifest, key);
  assert.deepEqual(verifyBackupManifest(signed, key), manifest);
  assert.throws(() => verifyBackupManifest(signed, randomBytes(32)), /认证/);
  for (const mutate of [
    (value) => { value.source.image = "attacker/image:latest"; },
    (value) => { value.source.systemIdentifier = "999"; },
    (value) => { value.completedAt = "2030-01-01T00:00:00Z"; },
    (value) => { value.walRanges[0]["End-LSN"] = "0/9000100"; },
    (value) => { value.files = []; },
  ]) { const changed = structuredClone(signed); mutate(changed); assert.throws(() => verifyBackupManifest(changed, key), /认证/); }
  const reordered = Object.fromEntries(Object.entries(signed).reverse());
  assert.deepEqual(verifyBackupManifest(reordered, key), manifest);
});
