import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const DATABASE_PROJECTS = ["db", "applicant", "investigator", "assessor", "manager", "gatherer", "scholar", "assistant", "designer"];

export function resolveDatabaseBaseUrl(project, env = process.env) {
  if (env.MT_TEST_DATABASE_URL) return env.MT_TEST_DATABASE_URL;
  if (project === "manager" && env.MANAGER_TEST_DATABASE_URL) {
    let url;
    try { url = new URL(env.MANAGER_TEST_DATABASE_URL); } catch { throw new Error("Manager 配置必须指向专用测试库"); }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !/^\/mt_[a-z0-9_]*test$/.test(url.pathname)) throw new Error("Manager 配置必须指向专用测试库");
    url.pathname = "/postgres";
    return url.toString();
  }
  return undefined;
}

export function validateDatabaseManifest(manifest, root) {
  if (manifest?.schema !== "magictools-database-suites/1" || !Array.isArray(manifest.projects) || manifest.projects.length !== DATABASE_PROJECTS.length) throw new Error("关键数据库清单版本或项目覆盖无效");
  const ids = new Set();
  for (const project of manifest.projects) {
    if (!DATABASE_PROJECTS.includes(project.id) || ids.has(project.id)) throw new Error("数据库清单含未知或重复项目");
    ids.add(project.id);
    const directory = project.id === "db" ? "packages/db" : `apps/${project.id}/server`;
    if (project.directory !== directory || !Array.isArray(project.files) || !project.files.length) throw new Error("数据库清单路径无效或项目没有套件");
    const files = new Set();
    for (const file of project.files) {
      if (typeof file.path !== "string" || !/^src\/[A-Za-z0-9_./-]+\.(test|spec)\.ts$/.test(file.path) || file.path.split("/").includes("..") || files.has(file.path)) throw new Error("数据库清单含非法或重复文件");
      if (!Number.isInteger(file.minimumTests) || file.minimumTests < 1) throw new Error("数据库清单最低执行数必须为正整数");
      if (!existsSync(join(root, directory, file.path))) throw new Error("数据库清单声明的文件不存在：" + file.path);
      if (/postgres(?:ql)?:\/\//.test(readFileSync(join(root, directory, file.path), "utf8"))) throw new Error("关键数据库用例不得硬编码连接串：" + file.path);
      files.add(file.path);
    }
    const marked = readdirSync(join(root, directory, "src"), { recursive: true }).filter((file) => /\.(test|spec)\.ts$/.test(file)).map((file) => "src/" + file.replace(/\\/g, "/"))
      .filter((file) => {
        const source = readFileSync(join(root, directory, file), "utf8");
        if (/available\s*=\s*false/.test(source) && !source.includes("@database-integration")) throw new Error("有数据库守卫的用例未声明关键模式：" + file);
        return source.includes("@database-integration");
      });
    const config = readFileSync(join(root, directory, "vitest.config.ts"), "utf8");
    const excluded = [...config.matchAll(/["'](src\/[^"']+\.(?:test|spec)\.ts)["']/g)].map((match) => match[1]);
    const expected = [...files].sort().join("\n");
    if (marked.sort().join("\n") !== expected || excluded.sort().join("\n") !== expected) throw new Error("数据库清单与关键文件标记或普通单测排除项不一致");
  }
  return manifest;
}

export function createDatabasePlan({ baseUrl, project, runId }) {
  if (!baseUrl) throw new Error("必须显式配置 MT_TEST_DATABASE_URL，禁止默认连接业务数据库");
  let base;
  try { base = new URL(baseUrl); } catch { throw new Error("MT_TEST_DATABASE_URL 格式无效"); }
  if (!["postgres:", "postgresql:"].includes(base.protocol) || base.pathname !== "/postgres") {
    throw new Error("测试入口必须使用 postgres 库的管理连接，不能使用业务库");
  }
  if (!DATABASE_PROJECTS.includes(project) || !/^[a-z0-9]{4,16}$/.test(runId ?? "")) throw new Error("测试项目或运行命名空间无效");
  const upstream = { assessor: ["investigator"], manager: ["assessor"], scholar: ["gatherer"], assistant: ["scholar"] };
  const roles = [project, ...upstream[project] ?? []];
  const databases = roles.map((role) => {
    const name = `mt_${runId}_${project}_${role}_test`;
    const target = new URL(base); target.pathname = "/" + name;
    return { project: role, name, url: target.toString(), create: true };
  });
  const env = { DATABASE_URL: databases[0].url, TEST_DATABASE_URL: databases[0].url };
  for (const db of databases.slice(1)) env[db.project.toUpperCase() + "_DATABASE_URL"] = db.url;
  if (project === "manager") env.MANAGER_TEST_DATABASE_URL = databases[0].url;
  if (project === "investigator") {
    const name = `mt_${runId}_${project}_bootstrap_test`;
    const url = new URL(base); url.pathname = "/" + name;
    databases.push({ project, name, url: url.toString(), create: false });
    env.MT_TEST_BOOTSTRAP_DATABASE_URL = url.toString();
    env.MT_TEST_ADMIN_URL = base.toString();
  }
  return { project, runId, adminUrl: base.toString(), databases, env };
}

export function validateDatabaseReport(report, expectedFiles) {
  if (report?.success !== true || !Array.isArray(report.testResults) || report.numFailedTests > 0 || report.numFailedTestSuites > 0) {
    throw new Error("数据库测试报告失败或无效");
  }
  if (!expectedFiles.length) throw new Error("关键套件清单为空");
  for (const key of ["numFailedTests", "numFailedTestSuites", "numPendingTests", "numTodoTests", "numPassedTests", "numTotalTests"]) {
    if (report[key] !== undefined && (!Number.isInteger(report[key]) || report[key] < 0)) throw new Error("数据库报告统计字段无效：" + key);
  }
  if (report.numPendingTests > 0 || report.numTodoTests > 0) throw new Error("报告汇总包含 skip/todo，不能记为通过");
  const normalized = (value) => value.replace(/\\/g, "/");
  const suites = new Map(report.testResults.map((suite) => [normalized(suite.name), suite]));
  let passed = 0;
  for (const file of expectedFiles) {
    if (!Number.isInteger(file.minimumTests) || file.minimumTests < 1) throw new Error("最低执行数必须为正整数");
    const suite = suites.get(normalized(file.path));
    if (!suite) throw new Error("报告缺失关键套件：" + file.path);
    if (suite.status !== "passed") throw new Error("关键套件失败：" + file.path);
    const assertions = suite.assertionResults;
    if (!Array.isArray(assertions) || assertions.length < file.minimumTests || !assertions.length) {
      throw new Error("关键套件执行数不足：" + file.path);
    }
    for (const assertion of assertions) {
      if (["pending", "skipped", "todo"].includes(assertion.status)) throw new Error("关键数据库验证不允许 skip/todo：" + file.path);
      if (assertion.status !== "passed") throw new Error("关键数据库用例未通过：" + file.path);
      passed += 1;
    }
  }
  if (suites.size !== expectedFiles.length || suites.size !== report.testResults.length) throw new Error("测试报告含未声明或重复的套件");
  if ((report.numTotalTests !== undefined && report.numTotalTests !== passed) || (report.numPassedTests !== undefined && report.numPassedTests !== passed)) throw new Error("数据库报告汇总与实际执行明细不符");
  return { files: suites.size, passed, failed: 0, skipped: 0 };
}

export function validateDatabaseEvidence(evidence, manifest) {
  if (manifest?.schema !== "magictools-database-suites/1" || !Array.isArray(manifest.projects) || manifest.projects.length !== DATABASE_PROJECTS.length) throw new Error("可信数据库验证清单缺失");
  if (evidence?.schema !== "magictools-database-validation/1" || evidence.success !== true || !Array.isArray(evidence.projects) || evidence.projects.length !== manifest.projects.length) throw new Error("数据库阶段未实际完成全部项目");
  const declared = new Set();
  for (const project of manifest.projects) {
    if (!DATABASE_PROJECTS.includes(project.id) || declared.has(project.id)) throw new Error("数据库验证清单项目无效");
    declared.add(project.id);
    const matches = evidence.projects.filter((item) => item.project === project.id);
    const result = matches[0];
    if (matches.length !== 1 || result.success !== true || !Array.isArray(result.files) || !Array.isArray(project.files) || !project.files.length || result.files.length !== project.files.length) throw new Error("数据库项目明细缺失或失败：" + project.id);
    for (const file of project.files) {
      const matches = result.files.filter((item) => item.path === file.path);
      const actual = matches[0];
      if (matches.length !== 1 || actual.success !== true || actual.exitCode !== 0) throw new Error("数据库文件未实际通过：" + file.path);
      const counts = validateDatabaseReport(actual.verificationReport, [{ path: project.directory + "/" + file.path, minimumTests: file.minimumTests }]);
      for (const key of ["files", "passed", "failed", "skipped"]) if (actual.counts?.[key] !== counts[key]) throw new Error("数据库统计与执行明细不符：" + file.path);
    }
  }
}
