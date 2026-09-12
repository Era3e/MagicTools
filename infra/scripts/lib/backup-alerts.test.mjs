import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { recordBackupFailure } from "./backup-alerts.mjs";
import { backupCommand } from "../backup.mjs";

function directory(t) {
  const path = mkdtempSync(join(tmpdir(), "mt-backup-alerts-"));
  t.after(() => { assert.ok(resolve(path).startsWith(resolve(tmpdir()) + sep + "mt-backup-alerts-")); assert.equal(lstatSync(path).isSymbolicLink(), false); rmSync(path, { recursive: true }); });
  return path;
}
async function receiver(t, handler) {
  const server = createServer(handler);
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return "http://127.0.0.1:" + server.address().port + "/receive";
}

test("真实HTTP接收失败告警且落盘，原始错误和凭证不进入事件", async (t) => {
  let received; const url = await receiver(t, async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    received = { body: JSON.parse(Buffer.concat(chunks)), authorization: request.headers.authorization };
    response.writeHead(202); response.end("accepted");
  });
  const result = await recordBackupFailure({ directory: directory(t), operation: "create", operationId: "0123456789abcdef", stage: "encrypt",
    error: new Error("postgres://user:secret-password@server/db"), configuration: { schema: "magictools-backup-alert/1", type: "webhook", url, headers: { Authorization: "Bearer private-alert-token" } } });
  assert.equal(result.notification.status, "accepted");
  assert.equal(received.body.event.operationId, "0123456789abcdef");
  assert.equal(received.authorization, "Bearer private-alert-token");
  const event = readFileSync(result.eventFile, "utf8"); const receipt = readFileSync(result.deliveryFile, "utf8");
  assert.ok(!JSON.stringify(received.body).includes("secret-password"));
  assert.ok(!event.includes("private-alert-token") && !receipt.includes("private-alert-token"));
  assert.equal(JSON.parse(event).stage, "encrypt");
});

test("CLI在取得store之前失败也记录事件并实际投递，原始失败仍向上抛出", async (t) => {
  let received; const url = await receiver(t, async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk); received = JSON.parse(Buffer.concat(chunks)); response.end("ok");
  });
  const root = directory(t); const config = join(root, "private-notify.json"); const events = join(root, "events");
  writeFileSync(config, JSON.stringify({ schema: "magictools-backup-alert/1", type: "webhook", url }));
  await assert.rejects(backupCommand(["create", "--container", "fixture-source", "--directory", join(root, "store"), "--key-file", join(root, "missing.key"),
    "--credentials-file", join(root, "missing.json"), "--notify-config", config, "--events-dir", events]), (error) => {
    assert.equal(error.alert.notification.status, "accepted"); assert.equal(error.alert.persistence.event, "written");
    assert.equal(received.event.operationId, error.operationId); assert.equal(received.event.stage, "preflight"); return true;
  });
  assert.equal(readdirSync(events).length, 2);
});

test("本地落盘失败仍尝试发送，HTTP拒绝与未配置可区分", async (t) => {
  let calls = 0; const url = await receiver(t, (request, response) => { calls++; response.writeHead(503); response.end(); });
  const root = directory(t); const blocked = join(root, "file"); writeFileSync(blocked, "do not overwrite");
  const result = await recordBackupFailure({ directory: blocked, operation: "verify", configuration: { schema: "magictools-backup-alert/1", type: "webhook", url } });
  assert.equal(calls, 1); assert.deepEqual(result.persistence, { event: "failed", delivery: "failed" }); assert.equal(result.notification.code, "HTTP_REJECTED");
  const unconfigured = await recordBackupFailure({ directory: root, operation: "verify" });
  assert.equal(unconfigured.notification.status, "not-configured"); assert.equal(readFileSync(blocked, "utf8"), "do not overwrite");
});

test("重定向不转发凭证，超时不无限等待，非法header不发请求", async (t) => {
  let forwarded = 0; const destination = await receiver(t, (request, response) => { forwarded++; response.end(); });
  const redirect = await receiver(t, (request, response) => { response.writeHead(302, { location: destination }); response.end(); });
  const root = directory(t); const common = { schema: "magictools-backup-alert/1", type: "webhook", headers: { Authorization: "Bearer private" } };
  const result = await recordBackupFailure({ directory: root, operation: "restore", configuration: { ...common, url: redirect } });
  assert.equal(forwarded, 0); assert.equal(result.notification.code, "TRANSPORT_FAILED");
  const hanging = await receiver(t, () => {}); const start = Date.now();
  const timeout = await recordBackupFailure({ directory: root, operation: "create", configuration: { ...common, url: hanging, timeoutMilliseconds: 25 } });
  assert.equal(timeout.notification.status, "failed"); assert.ok(Date.now() - start < 3000);
  for (const headers of [{ Host: "override.invalid" }, { "content-length": "0" }, ["private"], { Authorization: 42 }, { Authorization: "Bearer private", authorization: "duplicate" }]) {
    const invalid = await recordBackupFailure({ directory: root, operation: "prune", configuration: { ...common, url: destination, headers } });
    assert.equal(invalid.notification.status, "configuration-failed");
  }
  assert.equal(forwarded, 0);
});
