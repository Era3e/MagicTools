import test from "node:test";
import assert from "node:assert/strict";
import { createDatabasePlan, resolveDatabaseBaseUrl, validateDatabaseReport } from "./database-validation.mjs";

test("数据库验证拒绝把业务库作为测试入口", () => {
  assert.throws(() => createDatabasePlan({ baseUrl: "postgres://postgres:password@127.0.0.1:55433/manager", project: "manager", runId: "run12345" }), /postgres.*管理连接/);
  assert.throws(() => createDatabasePlan({ project: "manager", runId: "run12345" }), /MT_TEST_DATABASE_URL/);
});

test("Manager 旧单项目配置继续可用且不会直接清理旧库", () => {
  const baseUrl = resolveDatabaseBaseUrl("manager", { MANAGER_TEST_DATABASE_URL: "postgres://postgres:test@127.0.0.1:55433/mt_manager_test" });
  assert.equal(new URL(baseUrl).pathname, "/postgres");
  const plan = createDatabasePlan({ baseUrl, project: "manager", runId: "compat123" });
  assert.notEqual(new URL(plan.env.DATABASE_URL).pathname, "/mt_manager_test");
  assert.throws(() => resolveDatabaseBaseUrl("manager", { MANAGER_TEST_DATABASE_URL: "postgres://postgres:test@127.0.0.1:55433/manager" }), /专用/);
});

test("数据库报告不能以 skip、缺失套件或零用例通过", () => {
  const file = "/repo/apps/manager/server/src/requirement.e2e.test.ts";
  const expected = [{ path: file, minimumTests: 1 }];
  const report = { success: true, testResults: [{ name: file, status: "passed", assertionResults: [{ status: "passed" }] }] };
  assert.equal(validateDatabaseReport(report, expected).passed, 1);
  assert.throws(() => validateDatabaseReport({ ...report, testResults: [] }, expected), /缺失/);
  assert.throws(() => validateDatabaseReport({ ...report, testResults: [{ ...report.testResults[0], assertionResults: [] }] }, expected), /执行数/);
  assert.throws(() => validateDatabaseReport({ ...report, testResults: [{ ...report.testResults[0], assertionResults: [{ status: "pending" }] }] }, expected), /skip|跳过/);
});

test("两次运行与跨项目的上游清场使用不同专用数据库", () => {
  const input = { baseUrl: "postgres://postgres:password@127.0.0.1:55433/postgres", runId: "run12345" };
  const manager = createDatabasePlan({ ...input, project: "manager" });
  const assessor = createDatabasePlan({ ...input, project: "assessor" });
  const retry = createDatabasePlan({ ...input, project: "manager", runId: "retry123" });
  assert.ok(manager.databases.some((db) => db.project === "assessor"));
  assert.notEqual(manager.env.ASSESSOR_DATABASE_URL, assessor.env.DATABASE_URL);
  assert.notEqual(manager.env.DATABASE_URL, retry.env.DATABASE_URL);
  for (const db of manager.databases) assert.match(new URL(db.url).pathname, /^\/mt_[a-z0-9_]+_test$/);
});
