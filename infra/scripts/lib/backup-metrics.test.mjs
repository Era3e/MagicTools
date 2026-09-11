import test from "node:test";
import assert from "node:assert/strict";
import { recoveryObservation } from "./backup-metrics.mjs";

const observation = () => ({ incidentAt: "2026-09-12T00:01:00.000Z", guaranteedCoverageAt: "2026-09-12T00:00:20.000Z",
  restoredMarker: { recordedAt: "2026-09-12T00:00:10.000Z", confirmedAt: "2026-09-12T00:00:10.050Z" },
  missingMarker: { recordedAt: "2026-09-12T00:00:50.000Z", confirmedAt: "2026-09-12T00:00:50.030Z" },
  restoreMilliseconds: 1234, encryptedBytes: 1000000, databaseBytes: 800000, businessDatabases: 8 });

test("用同一源时钟的恢复/缺失样本记录RPO区间及真实数据库RTO", () => {
  const result = recoveryObservation(observation());
  assert.equal(result.rpo.observedMarkerGapSeconds, 50);
  assert.deepEqual(result.rpo.recoveryPointAgeSeconds, { minimum: 10, maximum: 40 });
  assert.equal(result.rpo.commitConfirmationWindowMilliseconds, 50);
  assert.equal(result.rto.databaseRestoreMilliseconds, 1234);
  assert.equal(result.rto.backupDownloadIncluded, false);
  assert.equal(result.scope.offsite, "not-measured");
});

test("缺少测量、时钟顺序错误或无效规模不能生成看似成功的RPO/RTO", () => {
  for (const mutate of [
    (value) => { value.incidentAt = "invalid"; },
    (value) => { value.guaranteedCoverageAt = "2026-09-12T00:02:00Z"; },
    (value) => { value.restoredMarker.confirmedAt = "2026-09-12T00:00:09Z"; },
    (value) => { value.missingMarker.confirmedAt = "2026-09-12T00:02:00Z"; },
    (value) => { value.restoreMilliseconds = 0; },
    (value) => { value.encryptedBytes = -1; },
  ]) { const value = observation(); mutate(value); assert.throws(() => recoveryObservation(value), /测量|时钟|规模/); }
});
