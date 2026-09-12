import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { digestBytes } from "./release-artifacts.mjs";
import { reserveRecoveryAttachment, recordRecoveryClaim, confirmRecoveryInitialValidation } from "./recovery-attachment.mjs";

function fixture(t) {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "mt-recovery-attachment-"));
  t.after(() => { assert.ok(resolve(root).startsWith(realpathSync(tmpdir()) + sep + "mt-recovery-attachment-")); assert.equal(lstatSync(root).isSymbolicLink(), false); rmSync(root, { recursive: true }); });
  const stateDirectory = join(root, "state"); mkdirSync(join(stateDirectory, "deploy.lock"), { recursive: true });
  const attemptId = "a".repeat(16); writeFileSync(join(stateDirectory, "deploy.lock/owner.json"), JSON.stringify({ attemptId }));
  const binding = { schema: "magictools-restored-database/1", mode: "restored", restoreOperationId: "1".repeat(16), backupId: "2".repeat(16), manifestSha256: "3".repeat(64), catalogSha256: "4".repeat(64),
    restoredAt: "2026-09-12T02:00:00Z", container: { name: "recovered-test", id: "b".repeat(64) }, network: { name: "recovered-test-net", id: "c".repeat(64) },
    volume: { name: "recovered-test-data", createdAt: "2026-09-12T01:59:00Z" }, source: { systemIdentifier: "1234567890123456", serverVersion: 160015,
      image: { reference: "pgvector/pgvector@sha256:" + "d".repeat(64), platform: "linux/amd64" }, dataDirectory: "/pg/data", configFile: "/pg/data/postgresql.conf" },
    databases: ["applicant", "assessor", "assistant", "designer", "gatherer", "investigator", "manager", "scholar"] };
  return { stateDirectory: realpathSync(stateDirectory), attemptId, owner: digestBytes(realpathSync(stateDirectory)), project: "recovery-test", binding,
    resources: { containers: [], networks: [], volumes: [] }, previousState: null };
}
const read = (context) => JSON.parse(readFileSync(join(context.stateDirectory, "recovery-binding.json"), "utf8"));

test("真实状态目录保留未验证阶段，只有明确的首次校验事实才推进", (t) => {
  const context = fixture(t); const reserved = reserveRecoveryAttachment(context);
  assert.equal(reserved.phase, "reserved");
  const claim = { name: "mt-recovery-" + context.binding.restoreOperationId + "-claim", id: "e".repeat(64), owner: context.owner, project: context.project, bindingHash: reserved.bindingHash, reused: false };
  recordRecoveryClaim(context, claim);
  const retried = reserveRecoveryAttachment({ ...context, resources: { containers: [{ id: "f".repeat(64) }], networks: [], volumes: [] } });
  assert.equal(retried.phase, "reserved"); assert.equal(retried.initialVerifiedAt, null);
  const evidence = { bindingHash: reserved.bindingHash, restoreOperationId: context.binding.restoreOperationId, backupId: context.binding.backupId,
    container: context.binding.container, network: context.binding.network, volume: context.binding.volume, systemIdentifier: context.binding.source.systemIdentifier,
    running: true, internalNetwork: true, catalogSha256: context.binding.catalogSha256, initialCatalogMatched: false };
  assert.throws(() => confirmRecoveryInitialValidation(context, evidence, claim), /首次/);
  assert.equal(read(context).phase, "reserved");
  const verified = confirmRecoveryInitialValidation(context, { ...evidence, initialCatalogMatched: true }, claim);
  assert.equal(verified.phase, "initial-verified"); assert.ok(verified.initialVerifiedAt);
  assert.equal(reserveRecoveryAttachment(context).initialVerifiedAt, verified.initialVerifiedAt);
  assert.equal(read(context).claim.id, claim.id);
  assert.ok(existsSync(join(context.stateDirectory, "deploy.lock/owner.json")));
});

test("损坏或被替换的声明不能借有效数据库事实推进首次验证", (t) => {
  for (const changed of [{}, { name: "wrong", id: "8".repeat(64) }, "not-a-claim", { name: "mt-recovery-" + "1".repeat(16) + "-claim", id: "9".repeat(64) }]) {
    const context = fixture(t); const reserved = reserveRecoveryAttachment(context);
    const claim = { name: "mt-recovery-" + context.binding.restoreOperationId + "-claim", id: "e".repeat(64), owner: context.owner, project: context.project, bindingHash: reserved.bindingHash, reused: false };
    recordRecoveryClaim(context, claim);
    writeFileSync(join(context.stateDirectory, "recovery-binding.json"), JSON.stringify({ ...read(context), claim: changed }));
    const facts = { bindingHash: reserved.bindingHash, restoreOperationId: context.binding.restoreOperationId, backupId: context.binding.backupId,
      container: context.binding.container, network: context.binding.network, volume: context.binding.volume, systemIdentifier: context.binding.source.systemIdentifier,
      running: true, internalNetwork: true, catalogSha256: context.binding.catalogSha256, initialCatalogMatched: true };
    assert.throws(() => confirmRecoveryInitialValidation(context, facts, claim));
    assert.equal(read(context).phase, "reserved");
  }
});
