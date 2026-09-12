import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryObservation } from './backup-metrics.mjs';

const base=()=>({incidentAt:'2026-09-12T00:01:00.000Z',guaranteedCoverageAt:'2026-09-12T00:00:20.000Z',
  restoredMarker:{recordedAt:'2026-09-12T00:00:10.000Z',confirmedAt:'2026-09-12T00:00:10.050Z'},
  missingMarker:{recordedAt:'2026-09-12T00:00:50.000Z',confirmedAt:'2026-09-12T00:00:50.030Z'},
  restoreMilliseconds:1234,encryptedBytes:1000000,databaseBytes:800000,businessDatabases:8});
const microseconds=value=>{
  const fraction=value.match(/[T ]\d\d:\d\d:\d\d(?:\.(\d+))?/)?.[1]??'';
  return BigInt(Date.parse(value))*1000n+BigInt(fraction.padEnd(6,'0').slice(3,6));
};
// 缩减的真实微秒格式回归样例；固定数值不代表当前环境的性能指标。
const realInput=()=>({ incidentAt:'2026-09-11 23:24:05.473274+00', guaranteedCoverageAt:'2026-09-11T23:23:49.10104+00:00',
  restoredMarker:{recordedAt:'2026-09-11T23:23:48.035309+00:00',confirmedAt:'2026-09-11T23:23:48.170939+00:00'},
  missingMarker:{recordedAt:'2026-09-11T23:24:05.178637+00:00',confirmedAt:'2026-09-11T23:24:05.339409+00:00'},
  encryptedBytes:103114866,databaseBytes:69704911,businessDatabases:8,restoreMilliseconds:23752 });

test('独立指标审查：整数毫秒样本的RPO区间方向和计量单位正确',()=>{
  const value=recoveryObservation(base());assert.deepEqual(value.rpo.recoveryPointAgeSeconds,{minimum:10,maximum:40});
  assert.equal(value.rpo.observedMarkerGapSeconds,50);assert.equal(value.rto.databaseRestoreMilliseconds,1234);
  assert.equal(value.scope.offsite,'not-measured');assert.equal(value.scope.platformCutover,'not-measured');assert.equal(value.rto.backupDownloadIncluded,false);
});

test('独立指标审查：同一时刻的时区表示不改变结果',()=>{
  const value=base();value.incidentAt='2026-09-12T08:01:00.000+08:00';
  assert.deepEqual(recoveryObservation(value).rpo.recoveryPointAgeSeconds,recoveryObservation(base()).rpo.recoveryPointAgeSeconds);
});

test('独立指标审查：实际报告样本可重算且RTO和规模保持原值',()=>{
  const value=recoveryObservation(realInput());
  assert.equal(value.rto.databaseRestoreMilliseconds,23752);assert.equal(value.size.encryptedBytes,103114866);assert.equal(value.size.businessDatabases,8);
});

test('独立指标审查：缺时区、明显乱序和未测耗时不能形成指标',()=>{
  for(const change of [
    value=>{value.incidentAt='2026-09-12T00:01:00';},
    value=>{value.guaranteedCoverageAt='2026-09-12T00:01:01Z';},
    value=>{value.restoreMilliseconds=NaN;},
    value=>{value.databaseBytes=0;},
  ]){const value=base();change(value);assert.throws(()=>recoveryObservation(value));}
});

test('独立指标审查：真实微秒样本生成的保守区间不能向内取整',()=>{
  const input=realInput();const result=recoveryObservation(input).rpo.recoveryPointAgeSeconds;
  const incident=microseconds(input.incidentAt);
  const exactMinimum=Number(incident-microseconds(input.missingMarker.recordedAt))/1e6;
  const exactMaximum=Number(incident-microseconds(input.guaranteedCoverageAt))/1e6;
  assert.ok(result.minimum<=exactMinimum && result.maximum>=exactMaximum,
    JSON.stringify({reported:result,derivedFromSourceMicroseconds:{minimum:exactMinimum,maximum:exactMaximum}}));
});

test('独立指标审查：保留在输入中的亚毫秒提交确认倒序必须被拒绝',()=>{
  const value=base();value.restoredMarker.recordedAt='2026-09-12T00:00:10.000900Z';value.restoredMarker.confirmedAt='2026-09-12T00:00:10.000100Z';
  assert.throws(()=>recoveryObservation(value),/时钟|顺序|测量/);
});
