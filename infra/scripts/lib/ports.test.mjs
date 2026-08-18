import { test } from "node:test";
import assert from "node:assert/strict";
import { allocPorts, nextFree } from "./ports.mjs";

test("nextFree 跳过已占用端口", () => {
  assert.equal(nextFree([4001, 4002], 4001), 4003);
});

test("allocPorts 未登记时从 4001/5001 起顺序分配且不冲突", () => {
  const a = allocPorts({}, "applicant");
  assert.deepEqual(a, { web: 4001, server: 5001 });
  const b = allocPorts({ applicant: a }, "gatherer");
  assert.deepEqual(b, { web: 4002, server: 5002 });
});

test("allocPorts 已登记时复用保留端口", () => {
  const out = allocPorts({ applicant: { web: 4008, server: 5008 } }, "applicant");
  assert.deepEqual(out, { web: 4008, server: 5008 });
});
