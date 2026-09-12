import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream, createWriteStream, mkdtempSync, rmdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable, Writable } from 'node:stream';
import { createHash, randomBytes } from 'node:crypto';
import { encryptBackupStream, decryptBackupStream, signBackupManifest, verifyBackupManifest } from './backup-crypto.mjs';

const identity = { backupId: 'aaaaaaaa11111111', fileName: 'base.tar' };
const key = randomBytes(32);
const fixtureRoot = mkdtempSync(join(tmpdir(), 'mt-backup-crypto-review-'));
after(() => rmdirSync(fixtureRoot));
const collect = () => {
  const chunks = [];
  return { stream: new Writable({ write(chunk, _, done) { chunks.push(Buffer.from(chunk)); done(); } }), bytes: () => Buffer.concat(chunks) };
};
const baseManifest = () => ({ schema: 'magictools-backup/1', backupId: identity.backupId, source: { platform: 'linux/amd64' }, files: [{ fileName: 'base.tar' }] });

test('独立加密审查：32MiB流经不同分块恢复且生产者受背压约束', async () => {
  const file = join(fixtureRoot, 'cipher-' + randomBytes(6).toString('hex'));
  const output = createWriteStream(file, { flags: 'wx', highWaterMark: 16 * 1024 });
  const expectedHash = createHash('sha256'); let produced = 0; let lead = 0;
  const input = Readable.from((function* () {
    for (let index = 0; index < 512; index++) {
      const chunk = Buffer.alloc(64 * 1024, index % 251); expectedHash.update(chunk);
      produced += chunk.length; lead = Math.max(lead, produced - output.bytesWritten); yield chunk;
    }
  })());
  try {
    const metadata = await encryptBackupStream(input, output, { ...identity, key });
    assert.equal(metadata.plainBytes, 32 * 1024 * 1024);
    assert.ok(lead <= 2 * 1024 * 1024, '持续缓冲超过2MiB，未有效背压');
    const actualHash = createHash('sha256'); let restored = 0;
    const sink = new Writable({ highWaterMark: 1024, write(chunk, _, done) { actualHash.update(chunk); restored += chunk.length; setImmediate(done); } });
    await decryptBackupStream(createReadStream(file, { highWaterMark: 13 * 1024 }), sink, { ...identity, key, metadata });
    assert.equal(restored, produced); assert.equal(actualHash.digest('hex'), expectedHash.digest('hex'));
  } finally { unlinkSync(file); }
});

test('独立加密审查：生产者中断与消费者写入失败终止全部管道', async (t) => {
  for (const mode of ['read-failure', 'write-failure']) {
    await t.test(mode, async () => {
      const input = Readable.from((async function* () { yield Buffer.alloc(32); if (mode === 'read-failure') throw new Error('review source disconnected'); yield Buffer.alloc(32); })());
      const output = mode === 'write-failure' ? new Writable({ write(_, encoding, done) { done(new Error('review destination full')); } }) : collect().stream;
      await assert.rejects(encryptBackupStream(input, output, { ...identity, key }), /review/);
      assert.equal(input.destroyed, true); assert.equal(output.destroyed, true);
    });
  }
});

test('独立加密审查：截断、追加、错误tag、摘要和声明长度均被拒绝', async (t) => {
  const encrypted = collect();
  const metadata = await encryptBackupStream(Readable.from([Buffer.from('binary fixture for authenticated restore')]), encrypted.stream, { ...identity, key });
  for (const mode of ['truncate', 'append', 'tag', 'digest', 'length']) {
    await t.test(mode, async () => {
      let bytes = encrypted.bytes(); const changed = structuredClone(metadata);
      if (mode === 'truncate') bytes = bytes.subarray(0, bytes.length - 1);
      if (mode === 'append') bytes = Buffer.concat([bytes, Buffer.alloc(1)]);
      if (mode === 'tag') changed.tag = 'f'.repeat(32);
      if (mode === 'digest') changed.sha256 = 'f'.repeat(64);
      if (mode === 'length') { changed.plainBytes++; changed.encryptedBytes++; }
      await assert.rejects(decryptBackupStream(Readable.from([bytes]), collect().stream, { ...identity, key, metadata: changed }));
    });
  }
});

test('独立加密审查：空流和恰好容量上限的流可以认证恢复', async () => {
  for (const text of ['', '1234']) {
    const encrypted = collect(); const restored = collect();
    const metadata = await encryptBackupStream(Readable.from([Buffer.from(text)]), encrypted.stream, { ...identity, key, maxPlaintextBytes: 4 });
    await decryptBackupStream(Readable.from([encrypted.bytes()]), restored.stream, { ...identity, key, metadata });
    assert.equal(restored.bytes().toString(), text);
  }
});

test('独立清单审查：JSON落盘和键排序变化后仍可认证，嵌套元数据改动拒绝', () => {
  const manifest = { ...baseManifest(), unicode: '八库', values: [null, 0, false, { beta: 2, alpha: 1 }] };
  const signed = signBackupManifest(manifest, key); const parsed = JSON.parse(JSON.stringify(signed));
  assert.deepEqual(verifyBackupManifest(parsed, key), manifest);
  parsed.values[3].alpha = 2; assert.throws(() => verifyBackupManifest(parsed, key), /认证/);
});

test('独立清单审查：拒绝无法稳定JSON落盘的稀疏数组', () => {
  const manifest = baseManifest(); manifest.files = Array(1);
  assert.throws(() => signBackupManifest(manifest, key), /JSON|清单|数组/);
});

test('独立清单审查：清单根必须是对象，不能签发随后无法验证的数组根', () => {
  const manifest = Object.assign([], { schema: 'magictools-backup/1', backupId: identity.backupId });
  assert.throws(() => signBackupManifest(manifest, key), /JSON|清单|身份/);
});
