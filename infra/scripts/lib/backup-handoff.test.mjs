import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { backupCommand } from "../backup.mjs";
import { Readable } from "node:stream";
import { prepareRecoveryHandoff } from "./backup-handoff.mjs";
import { recoveryDatabaseFixture } from "./recovery-database-fixture.mjs";
import { acquireStore, hash } from "./backup-store.mjs";
import { encryptBackupStream, signBackupManifest } from "./backup-crypto.mjs";

test("交接命令先认证备份；无效输入不会写配置或改动原文件，失败有独立事件", async (t) => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "mt-backup-handoff-"));
  t.after(() => { assert.ok(resolve(root).startsWith(realpathSync(tmpdir()) + sep + "mt-backup-handoff-")); assert.equal(lstatSync(root).isSymbolicLink(), false); rmSync(root, { recursive: true }); });
  const backup = join(root, "store", "backup-" + "a".repeat(16)); mkdirSync(backup, { recursive: true });
  writeFileSync(join(backup, "backup.json"), "{}"); const key = join(root, "private.key"); writeFileSync(key, randomBytes(32));
  const config = join(root, "config.json"); const receipt = join(root, "restore.json"); const output = join(root, "handoff.json"); const events = join(root, "events");
  writeFileSync(config, JSON.stringify({ schema: "magictools-deployment-config/1", project: "recovery-test", gatewayBind: "127.0.0.1", gatewayPort: 55301, waitTimeoutSeconds: 120 }));
  writeFileSync(receipt, "{}"); const before = readFileSync(config);
  await assert.rejects(backupCommand(["handoff", "--backup", backup, "--key-file", key, "--restore-receipt", receipt, "--config", config, "--output", output, "--events-dir", events]), /认证/);
  assert.equal(existsSync(output), false); assert.ok(readFileSync(config).equals(before));
  const event = JSON.parse(readFileSync(join(events, readdirSync(events).find((file) => file.endsWith(".event.json")))));
  assert.equal(event.operation, "handoff"); assert.equal(event.stage, "preflight");
});

test("交接输出不得污染源store，实时PG检查后的密文变化也不能发布配置", async (t) => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "mt-handoff-integrity-"));
  t.after(() => { assert.ok(resolve(root).startsWith(realpathSync(tmpdir()) + sep + "mt-handoff-integrity-")); assert.equal(lstatSync(root).isSymbolicLink(), false); rmSync(root, { recursive: true }); });
  const world = recoveryDatabaseFixture(); const key = randomBytes(32); const keyFile = join(root, "private.key"); writeFileSync(keyFile, key);
  const store = join(root, "store"); const lease = acquireStore(store, { keyId: hash(key), systemIdentifier: world.binding.source.systemIdentifier }, "f".repeat(16), true);
  const storeId = lease.store.storeId; lease.release();
  const backupDirectory = join(store, "backup-" + world.binding.backupId); mkdirSync(backupDirectory); const files = [];
  for (const fileName of ["base.tar", "pg_wal.tar", "backup_manifest"]) files.push(await encryptBackupStream(Readable.from([Buffer.from("handoff fixture " + fileName)]),
    createWriteStream(join(backupDirectory, fileName + ".enc")), { key, backupId: world.binding.backupId, fileName }));
  const manifest = { ...world.manifest, storeId, files, walRanges: [{ Timeline: 1 }], completedAt: world.receipt.finishedAt,
    verification: { checksumAndWal: "passed", isolatedDatabaseStartup: "passed", catalog: "passed" } };
  writeFileSync(join(backupDirectory, "backup.json"), JSON.stringify(signBackupManifest(manifest, key)));
  const configFile = join(root, "base.json"); writeFileSync(configFile, JSON.stringify({ schema: "magictools-deployment-config/1", project: "handoff-test", gatewayBind: "127.0.0.1", gatewayPort: 55301, waitTimeoutSeconds: 120 }));
  const restoreReceiptFile = join(store, "attempt-" + world.receipt.operationId + ".json"); writeFileSync(restoreReceiptFile, JSON.stringify(world.receipt));
  const options = { backupDirectory, keyFile, configFile, restoreReceiptFile, outputFile: join(root, "handoff.json"), catalog: [{ service: "gateway" }] };
  await assert.rejects(prepareRecoveryHandoff({ ...options, outputFile: join(backupDirectory, "handoff.json") }, world.deps), /输出.*备份/);
  assert.equal(readdirSync(backupDirectory).length, 4);
  let changed = false;
  await assert.rejects(prepareRecoveryHandoff(options, { ...world.deps, databaseQuery: async (...args) => {
    if (!changed) { changed = true; const file = join(backupDirectory, "base.tar.enc"); const bytes = readFileSync(file); bytes[0] ^= 1; writeFileSync(file, bytes); }
    return world.deps.databaseQuery(...args);
  } }), /摘要/);
  assert.equal(changed, true); assert.equal(existsSync(options.outputFile), false);
});
