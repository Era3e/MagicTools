import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { createDatabasePlan, resolveDatabaseBaseUrl, validateDatabaseReport, validateDatabaseManifest } from "./lib/database-validation.mjs";
import { runPnpm } from "./lib/validation-process.mjs";
import { captureValidationIdentity } from "./lib/quality-evidence.mjs";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
createRequire(join(root, "packages/config/package.json"))("dotenv").config({ path: join(root, ".env"), override: false });
const manifestPath = join(root, "infra/testing/database-suites.json");

export async function prepareDatabases(plan) {
  const requireDb = createRequire(join(root, "packages/db/package.json"));
  const { Pool } = requireDb("pg");
  const { runMigrations } = requireDb("./dist/index.js");
  const admin = new Pool({ connectionString: plan.adminUrl, connectionTimeoutMillis: 5000 });
  try {
    const version = await admin.query("SHOW server_version_num");
    if (Number(version.rows[0].server_version_num) < 160000) throw new Error("关键数据库验证需要 PostgreSQL 16 或更新版本");
    if (plan.databases.some((db) => db.project === "scholar")) {
      const extension = await admin.query("SELECT 1 FROM pg_available_extensions WHERE name='vector'");
      if (!extension.rowCount) throw new Error("缺少 pgvector，不能运行真实向量数据库验证");
    }
    for (const database of plan.databases) {
      if (!/^mt_[a-z0-9_]+_test$/.test(database.name) || database.name.length > 63) throw new Error("拒绝初始化非专用测试库");
      if (!database.create) continue;
      await admin.query(`CREATE DATABASE "${database.name}"`);
      const pool = new Pool({ connectionString: database.url, connectionTimeoutMillis: 5000 });
      try {
        await runMigrations(pool, join(root, database.project === "db" ? "packages/db/migrations" : `apps/${database.project}/server/migrations`));
      } finally { await pool.end(); }
    }
  } finally { await admin.end(); }
}

export async function cleanupDatabases(plan) {
  const { Pool } = createRequire(join(root, "packages/db/package.json"))("pg");
  const admin = new Pool({ connectionString: plan.adminUrl, connectionTimeoutMillis: 5000 });
  try {
    for (const database of plan.databases) {
      if (!database.name.startsWith(`mt_${plan.runId}_${plan.project}_`) || !/^mt_[a-z0-9_]+_test$/.test(database.name)) throw new Error("拒绝清理非本次测试库");
      await admin.query(`DROP DATABASE IF EXISTS "${database.name}" WITH (FORCE)`);
    }
  } finally { await admin.end(); }
}

export async function runDatabaseValidation({ project, baseUrl, outputDirectory, buildDependencies = false, identity } = {}) {
  const runId = randomBytes(6).toString("hex");
  const directory = outputDirectory ?? join(root, ".qa", "database", runId);
  mkdirSync(directory, { recursive: true });
  const result = { schema: "magictools-database-validation/1", runId, startedAt: new Date().toISOString(),
    mode: { database: "real", external: "stub-or-mock", liveModel: "not-run" }, success: false, projects: [] };
  try {
    if (project !== undefined && (typeof project !== "string" || !project.length)) throw new Error("数据库测试项目参数不能为空");
    baseUrl ??= resolveDatabaseBaseUrl(project);
    const manifest = validateDatabaseManifest(JSON.parse(readFileSync(manifestPath, "utf8")), root);
    const selected = manifest.projects.filter((item) => !project || item.id === project);
    if (!selected.length) throw new Error("关键数据库测试项目不存在或清单为空");
    result.identity = identity ?? captureValidationIdentity(root, process.env, runId);
    if (buildDependencies) {
      createDatabasePlan({ baseUrl, project: selected[0].id, runId });
      result.dependencyBuild = await runPnpm(["exec", "turbo", "run", "build", ...["db", "config", "types", "utils", "model-client", "ui"].map((name) => "--filter=@mt/" + name)], { cwd: root });
      if (result.dependencyBuild.exitCode !== 0) throw new Error("数据库验证依赖构建失败");
    }
    for (const item of selected) {
      const record = { project: item.id, success: false, files: [] };
      result.projects.push(record);
      for (const [index, file] of item.files.entries()) {
        const fileRecord = { path: file.path, success: false };
        record.files.push(fileRecord);
        const plan = createDatabasePlan({ baseUrl, project: item.id, runId: randomBytes(6).toString("hex") });
        fileRecord.databases = plan.databases.map((db) => db.name);
        const reportFile = join(directory, `${item.id}-${index}.vitest.json`);
        if (existsSync(reportFile)) throw new Error("拒绝复用已有测试报告，请使用新的运行目录");
        await prepareDatabases(plan);
        const env = { ...process.env, ...plan.env, MT_DATABASE_TEST_MODE: "required", MT_LLM_STUB: "1", FT_STUB: "1",
          MT_DATABASE_TEST_FILES: JSON.stringify([file.path]) };
        for (const key of ["DEEPSEEK_API_KEY", "ZHIPU_API_KEY", "OPENAI_API_KEY", "GITHUB_TOKEN", "FEISHU_APP_SECRET", "CLAWCV_API_KEY", "CYBERCLOUD_API_KEY"]) delete env[key];
        const outcome = await runPnpm(["exec", "vitest", "run", "--config", join(root, "infra/testing/vitest.database.config.mjs"),
          "--reporter=default", "--reporter=json", "--outputFile=" + reportFile], { cwd: join(root, item.directory), env });
        fileRecord.exitCode = outcome.exitCode;
        if (outcome.exitCode !== 0) throw new Error(item.id + "/" + file.path + " 数据库套件失败，请查看原始测试错误");
        const raw = JSON.parse(readFileSync(reportFile, "utf8"));
        fileRecord.counts = validateDatabaseReport(raw, [{ ...file, path: join(root, item.directory, file.path) }]);
        fileRecord.verificationReport = { ...raw, testResults: raw.testResults.map((suite) => ({ ...suite, name: item.directory + "/" + file.path })) };
        fileRecord.success = true;
        await cleanupDatabases(plan);
      }
      record.success = true;
    }
    const currentIdentity = captureValidationIdentity(root, process.env, result.identity.validationId);
    for (const key of Object.keys(result.identity)) {
      if (currentIdentity[key] !== result.identity[key]) throw new Error("数据库验证期间工作树或运行身份变化：" + key);
    }
    result.success = true;
  } catch (error) {
    result.error = String(error);
    throw error;
  } finally {
    result.finishedAt = new Date().toISOString();
    writeFileSync(join(directory, "summary.json"), JSON.stringify(result, null, 2) + "\n");
    console.log("Database validation report:", join(directory, "summary.json"));
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--project" || !args[1] || args[1].startsWith("--"))) {
    console.error("用法：pnpm test:db [--project 项目]，项目参数不可缺失"); process.exitCode = 1;
  } else runDatabaseValidation({ project: args[1], buildDependencies: true }).catch((error) => {
    console.error(String(error)); process.exitCode = 1;
  });
}
