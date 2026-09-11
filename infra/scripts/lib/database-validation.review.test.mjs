import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { syncBuiltinESMExports } from "node:module";
import { DATABASE_PROJECTS, createDatabasePlan, validateDatabaseManifest, validateDatabaseReport } from "./database-validation.mjs";
import { runDatabaseValidation } from "../test-database.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = join(root, "infra/testing/database-suites.json");
const work = join(dirname(root), "database-review-logs");
const baseUrl = "postgres://postgres:postgres@127.0.0.1:55433/postgres";
const file = "/repo/packages/db/src/outbox.test.ts";
const expected = [{ path: file, minimumTests: 1 }];

function report(assertions = [{ status: "passed", fullName: "outbox writes" }]) {
  return { success: true, numFailedTests: 0, numFailedTestSuites: 0,
    testResults: [{ name: file, status: "passed", assertionResults: assertions }] };
}

async function withManifest(value, action) {
  const read = fs.readFileSync;
  fs.readFileSync = function (path, ...args) {
    if (typeof path === "string" && resolve(path) === manifestPath) {
      if (value instanceof Error) throw value;
      return typeof value === "string" ? value : JSON.stringify(value);
    }
    return read.call(fs, path, ...args);
  };
  syncBuiltinESMExports();
  try { return await action(); }
  finally { fs.readFileSync = read; syncBuiltinESMExports(); }
}

function outputDirectory(label) {
  fs.mkdirSync(work, { recursive: true });
  return fs.mkdtempSync(join(work, label + "-"));
}

test("独立验收：业务库、错误协议、非法项目和命名空间在连接前拒绝", () => {
  for (const url of [undefined, "invalid", baseUrl.replace(/\/postgres$/, "/manager"),
    baseUrl.replace(/\/postgres$/, "/mt_existing_test"), "https://localhost/postgres"]) {
    assert.throws(() => createDatabasePlan({ baseUrl: url, project: "db", runId: "review123" }));
  }
  for (const project of ["", "unknown", "../manager", "MANAGER", null]) {
    assert.throws(() => createDatabasePlan({ baseUrl, project, runId: "review123" }));
  }
  for (const runId of [undefined, "abc", "A123", "../run", "x".repeat(17)]) {
    assert.throws(() => createDatabasePlan({ baseUrl, project: "db", runId }));
  }
});

test("独立验收：全部项目、不同运行和上游角色名称唯一且不超过 PostgreSQL 标识符长度", () => {
  const names = new Set();
  for (const runId of ["a".repeat(16), "b".repeat(16)]) {
    for (const project of DATABASE_PROJECTS) {
      const plan = createDatabasePlan({ baseUrl, project, runId });
      assert.equal(new URL(plan.adminUrl).port, "55433");
      for (const db of plan.databases) {
        assert.match(db.name, /^mt_[a-z0-9_]+_test$/);
        assert.ok(Buffer.byteLength(db.name) <= 63);
        assert.equal(new URL(db.url).pathname, "/" + db.name);
        assert.equal(names.has(db.name), false, db.name);
        names.add(db.name);
      }
      assert.equal(plan.env.DATABASE_URL, plan.databases[0].url);
      assert.equal(plan.env.TEST_DATABASE_URL, plan.databases[0].url);
      for (const upstream of plan.databases.filter((db) => db.project !== project)) {
        assert.equal(plan.env[upstream.project.toUpperCase() + "_DATABASE_URL"], upstream.url);
      }
    }
  }
});

test("独立验收：自举库保留未创建状态，与主库分离", () => {
  const plan = createDatabasePlan({ baseUrl, project: "investigator", runId: "review123" });
  const bootstrap = plan.databases.find((db) => !db.create);
  assert.ok(bootstrap);
  assert.notEqual(bootstrap.url, plan.env.DATABASE_URL);
  assert.equal(bootstrap.url, plan.env.MT_TEST_BOOTSTRAP_DATABASE_URL);
  assert.equal(plan.env.MT_TEST_ADMIN_URL, baseUrl);
});

test("独立验收：关键报告拒绝 missing、zero、skip、todo、失败和重复套件", () => {
  assert.deepEqual(validateDatabaseReport(report(), expected), { files: 1, passed: 1, failed: 0, skipped: 0 });
  for (const status of ["pending", "skipped", "todo", "failed", "unknown", undefined]) {
    assert.throws(() => validateDatabaseReport(report([{ status }]), expected), String(status));
  }
  assert.throws(() => validateDatabaseReport(report([]), expected));
  assert.throws(() => validateDatabaseReport({ ...report(), testResults: [] }, expected));
  const suite = report().testResults[0];
  assert.throws(() => validateDatabaseReport({ ...report(), testResults: [suite, { ...suite }] }, expected));
  assert.throws(() => validateDatabaseReport({ ...report(), numFailedTestSuites: 1 }, expected));
  assert.throws(() => validateDatabaseReport({ ...report(), numFailedTests: 1 }, expected));
  assert.throws(() => validateDatabaseReport(report(), []));
  assert.throws(() => validateDatabaseReport(report(), [{ path: file, minimumTests: 2 }]));
});

test("独立验收：最低测试数必须是正整数，不能通过非法阈值削弱门禁", () => {
  for (const minimumTests of [undefined, 0, -1, 0.5, "1", Number.NaN]) {
    assert.throws(() => validateDatabaseReport(report(), [{ path: file, minimumTests }]), String(minimumTests));
  }
});

test("独立验收：报告全局 pending/todo 与明细不一致不能记为全绿", () => {
  assert.throws(() => validateDatabaseReport({ ...report(), numPendingTests: 1 }, expected));
  assert.throws(() => validateDatabaseReport({ ...report(), numTodoTests: 1 }, expected));
  assert.throws(() => validateDatabaseReport({ ...report(), success: "true" }, expected));
});

test("独立验收：当前清单覆盖所有项目且每条声明都真实存在并从普通单测排除", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.deepEqual(manifest.projects.map((p) => p.id).sort(), [...DATABASE_PROJECTS].sort());
  for (const project of manifest.projects) {
    assert.ok(project.files.length > 0);
    const config = fs.readFileSync(join(root, project.directory, "vitest.config.ts"), "utf8");
    for (const entry of project.files) {
      assert.ok(fs.existsSync(join(root, project.directory, entry.path)));
      assert.ok(Number.isInteger(entry.minimumTests) && entry.minimumTests > 0);
      assert.ok(config.includes(JSON.stringify(entry.path)), project.id + "/" + entry.path);
    }
  }
});

test("独立验收：从完整清单删掉单个关键文件也必须拒绝，不能双轨漏测", () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.projects.find((project) => project.id === "manager").files.pop();
  assert.throws(() => validateDatabaseManifest(manifest, root), /遗漏|缺失|清单|一致/);
});

test("独立验收：清单参数拒绝越界目录、重复文件、缺文件和非法阈值", () => {
  for (const change of [
    (manifest) => { manifest.projects[0].directory = "../../outside"; },
    (manifest) => { manifest.projects[0].files.push({ ...manifest.projects[0].files[0] }); },
    (manifest) => { manifest.projects[0].files[0].path = "src/missing-review.test.ts"; },
    (manifest) => { manifest.projects[0].files[0].path = "src/../../other.test.ts"; },
    (manifest) => { manifest.projects[0].files[0].minimumTests = 0; },
    (manifest) => { manifest.projects[0].files[0].minimumTests = "3"; },
  ]) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    change(manifest);
    assert.throws(() => validateDatabaseManifest(manifest, root));
  }
});

test("独立验收：清单含零文件项目时必须失败，不能输出成功报告", async () => {
  const manifest = { schema: "magictools-database-suites/1", projects: [{ id: "db", directory: "packages/db", files: [] }] };
  await withManifest(manifest, async () => {
    await assert.rejects(runDatabaseValidation({ baseUrl, project: "db", outputDirectory: outputDirectory("empty-files") }));
  });
});

test("独立验收：错误清单版本和重复项目不能通过", async () => {
  for (const change of [
    (manifest) => { manifest.schema = "wrong"; },
    (manifest) => { manifest.projects[1] = structuredClone(manifest.projects[0]); },
  ]) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    change(manifest);
    await withManifest(manifest, async () => {
      await assert.rejects(runDatabaseValidation({ baseUrl, project: "db", outputDirectory: outputDirectory("invalid-manifest") }));
    });
  }
});

test("独立验收：入口配置错误仍写出初始化失败记录，不泄露连接密码", async () => {
  const directory = outputDirectory("invalid-target");
  await assert.rejects(runDatabaseValidation({ baseUrl: "postgres://postgres:review-secret@127.0.0.1:55433/manager", project: "db", outputDirectory: directory }));
  const json = fs.readFileSync(join(directory, "summary.json"), "utf8");
  const summary = JSON.parse(json);
  assert.equal(summary.success, false);
  assert.equal(summary.projects[0].files[0].success, false);
  assert.ok(summary.error);
  assert.equal(json.includes("review-secret"), false);
});

test("独立验收：显式空项目参数不能被解释为运行全部项目", async () => {
  const directory = outputDirectory("empty-project");
  await assert.rejects(runDatabaseValidation({ project: "", baseUrl: baseUrl.replace(/\/postgres$/, "/manager"),
    outputDirectory: directory }), /项目/);
});

test("独立验收：非法 JSON、清单读取失败及文件缺失均保留失败 summary", async () => {
  const missingFile = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  missingFile.projects[0].files[0].path = "src/missing-review.test.ts";
  const readError = Object.assign(new Error("ENOENT: review manifest missing"), { code: "ENOENT" });
  for (const [label, value] of [["broken-json", "{"], ["missing-manifest", readError], ["missing-file", missingFile]]) {
    const directory = outputDirectory(label);
    await withManifest(value, async () => {
      await assert.rejects(runDatabaseValidation({ baseUrl, project: "db", outputDirectory: directory }));
    });
    assert.ok(fs.existsSync(join(directory, "summary.json")), label + " 缺少失败报告");
    const summary = JSON.parse(fs.readFileSync(join(directory, "summary.json"), "utf8"));
    assert.equal(summary.success, false);
    assert.ok(summary.error);
    assert.ok(summary.startedAt && summary.finishedAt);
  }
});
