import test from "node:test";
import assert from "node:assert/strict";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, lstatSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { backupRemote } from "./backup-ssh.mjs";
import { Readable } from "node:stream";
import { encryptBackupStream, signBackupManifest } from "./backup-crypto.mjs";
import { hash } from "./backup-store.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "mt-backup-ssh-"));
  t.after(() => { assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep + "mt-backup-ssh-")); assert.equal(lstatSync(root).isSymbolicLink(), false); rmSync(root, { recursive: true }); });
  const keyFile = join(root, "private.key"); writeFileSync(keyFile, randomBytes(32));
  return { root, options: { host: "backup-source", container: "source-pg", remoteDirectory: "/opt/magictools/backup-runner", remoteStore: "/var/backups/magictools", remoteKeyFile: "/etc/magictools/private.key", remoteCredentialsFile: "/etc/magictools/credentials.json", directory: join(root, "store"), keyFile } };
}

test("SSH参数前置拒绝命令注入、路径跳转与密钥误放，不能发出传输", async (t) => {
  const context = fixture(t); let calls = 0;
  for (const patch of [{ host: "host;echo bad" }, { host: "-oProxyCommand=bad" }, { remoteStore: "/var/backups/../private" }, { remoteKeyFile: "/var/backups/magictools/private.key" }, { keep: 0 }]) {
    await assert.rejects(backupRemote({ ...context.options, ...patch }, { outputDirectory: join(context.root, "evidence"), executeTransport: async () => { calls++; return { exitCode: 0, stdout: "" }; } }));
  }
  assert.equal(calls, 0);
});

test("SSH准备、上传、指纹校验与远端创建失败均保留失败回执，不宣称异机成功", async (t) => {
  for (const failureAt of [1, 2, 3, 4]) {
    const context = fixture(t); const calls = [];
    await assert.rejects(backupRemote(context.options, { outputDirectory: join(context.root, "evidence"), executeTransport: async (command, args) => {
      calls.push({ command, args }); return { exitCode: calls.length === failureAt ? 1 : 0, stdout: "" };
    } }));
    assert.equal(calls.length, failureAt);
    for (const call of calls) { assert.ok(call.args.includes("BatchMode=yes")); assert.ok(call.args.includes("StrictHostKeyChecking=yes")); }
    const runs = readdirSync(join(context.root, "evidence")); assert.equal(runs.length, 1);
    const report = JSON.parse(readFileSync(join(context.root, "evidence", runs[0], "transport.json")));
    assert.equal(report.success, false); assert.equal(report.copyVerified, false);
    assert.equal(report.remoteOutcome, failureAt < 4 ? "not-started" : "unknown");
    const payload = join(context.root, "evidence", runs[0], "payload");
    assert.ok(!readdirSync(payload).some((file) => /key|private|env/.test(file)));
  }
});

// 真实文件/加密；SSH和隔离恢复由受控适配器表达，用于校验编排，非远端或PG演练。
async function transferFixture(t, failureAt) {
  const context = fixture(t); const payload = join(context.root, "encrypted"); mkdirSync(payload);
  const key = readFileSync(context.options.keyFile); const backupId = "a".repeat(16); const files = [];
  for (const fileName of ["base.tar", "pg_wal.tar", "backup_manifest"]) files.push(await encryptBackupStream(Readable.from([Buffer.from("ssh fixture " + fileName)]),
    createWriteStream(join(payload, fileName + ".enc")), { key, backupId, fileName }));
  const signed = signBackupManifest({ schema: "magictools-backup/1", backupId, storeId: "b".repeat(16), status: "complete", files, databases: ["manager"],
    source: { systemIdentifier: "1234567890123456", serverVersion: 160015, dataDirectory: "/pg/data", image: { platform: "linux/amd64", reference: "pgvector/pgvector@sha256:" + "c".repeat(64) } },
    completedAt: new Date().toISOString(), catalogSha256: "d".repeat(64), walRanges: [{ Timeline: 1 }], verification: { checksumAndWal: "passed", isolatedDatabaseStartup: "passed", catalog: "passed" } }, key);
  const manifestBytes = Buffer.from(JSON.stringify(signed)); writeFileSync(join(payload, "backup.json"), manifestBytes);
  let transfer; const calls = []; let verified = false;
  const executeTransport = async (command, args) => {
    calls.push({ command, args }); const index = calls.length;
    if (index === failureAt) return { exitCode: 1, stdout: "" };
    if (index <= 3) return { exitCode: 0, stdout: "" };
    if (index === 4) {
      const transferId = args.at(-1).match(/'--transfer-id' '([a-f0-9]{16})'/)?.[1]; assert.ok(transferId);
      transfer = { schema: "magictools-backup-export/1", success: true, transferId, backupId, manifestSha256: hash(manifestBytes),
        sourceCreate: { operation: "create", operationId: backupId, backupId, success: true, stage: "complete" }, completedAt: new Date().toISOString() };
      return { exitCode: 0, stdout: JSON.stringify(transfer) };
    }
    if (command === "scp") {
      const name = args.at(-2).split("/").at(-1);
      writeFileSync(args.at(-1), name === "transfer.json" ? JSON.stringify(transfer) : readFileSync(join(payload, name)), { flag: "wx" });
      return { exitCode: 0, stdout: "" };
    }
    assert.equal(index, 10); assert.equal(verified, true, "不能在本地校验前删除远端导出副本");
    return { exitCode: 0, stdout: JSON.stringify({ success: true, transferId: transfer.transferId, backupId, cleanup: "passed" }) };
  };
  const verify = async ({ backupDirectory }) => {
    assert.ok(existsSync(backupDirectory)); verified = true;
    return { operationId: "e".repeat(16), backupId, cleanup: "passed", catalogVerified: true };
  };
  return { ...context, calls, dependencies: { outputDirectory: join(context.root, "evidence"), executeTransport, receiveDependencies: { verify } } };
}

test("SSH完整编排只有下载、认证与恢复成功后才清理远端导出并返回成功", async (t) => {
  const context = await transferFixture(t); const result = await backupRemote(context.options, context.dependencies);
  assert.equal(result.success, true); assert.equal(result.copyVerified, true); assert.equal(result.remoteExportCleanup, "passed");
  assert.ok(existsSync(result.copy.directory)); assert.equal(context.calls.length, 10);
  const files = readdirSync(join(context.root, "evidence", result.operationId, "payload/scripts/lib"));
  assert.ok(files.every((name) => name.endsWith(".mjs") && !name.endsWith(".test.mjs")));
});

test("SSH各下载阶段失败不会清理源导出或发布成功副本，清理失败单独报告", async (t) => {
  for (const failureAt of [5, 6, 7, 8, 9, 10]) {
    const context = await transferFixture(t, failureAt);
    await assert.rejects(backupRemote(context.options, context.dependencies));
    assert.equal(context.calls.length, failureAt);
    const id = readdirSync(join(context.root, "evidence"))[0]; const report = JSON.parse(readFileSync(join(context.root, "evidence", id, "transport.json")));
    assert.equal(report.success, false); assert.equal(report.copyVerified, failureAt === 10);
    assert.equal(existsSync(join(context.options.directory, "backup-" + "a".repeat(16))), failureAt === 10);
    if (failureAt === 10) assert.equal(report.stage, "ssh-cleanup");
  }
});
