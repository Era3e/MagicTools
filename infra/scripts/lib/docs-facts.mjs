import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { extractDeclaredPaths } from "./docs-guard.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const STATUS_PREFIXES = ["✅", "⚠️", "🚫", "📝"];
const GENERATED_FILES = [
  "docs/generated/feature-map.md",
  "docs/generated/coverage-view.md",
  "docs/generated/interface-index.md",
];

export function parseCoverageMatrix(md) {
  const modules = [];
  const items = [];
  let module = "";
  let headers = [];

  for (const line of md.split("\n")) {
    const moduleMatch = line.match(/^##\s+\d+\.\s+([^（(]+)/);
    if (moduleMatch) {
      module = moduleMatch[1].trim();
      if (!modules.includes(module)) modules.push(module);
      headers = [];
      continue;
    }
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.every((cell) => /^-+$/.test(cell.replace(/\s+/g, "")))) continue;
    if (cells.some((cell) => /^(#|编号)$/iu.test(cell))) {
      headers = cells;
      continue;
    }
    if (!module || cells.length < 4) continue;

    const id = cells[0];
    if (!/^[A-Za-z]{1,3}\d+$/u.test(id)) continue;
    const header = (name) => headers.findIndex((item) => item.includes(name));
    const fallback = {
      id: 0,
      title: 1,
      implementation: 3,
      status: 4,
      evidence: 5,
    };
    const titleIndex = header("功能点") >= 0 ? header("功能点") : header("能力") >= 0 ? header("能力") : fallback.title;
    const statusIndex = header("状态") >= 0 ? header("状态") : cells.findIndex((cell) => STATUS_PREFIXES.some((status) => cell.startsWith(status)));
    const implementationIndex = header("实现") >= 0 ? header("实现") : statusIndex > 2 ? 2 : fallback.implementation;
    const evidenceIndex = Math.max(statusIndex + 1, header("E2E") >= 0 ? header("E2E") : fallback.evidence);
    const status = cells[statusIndex] ?? "";
    if (!STATUS_PREFIXES.some((prefix) => status.startsWith(prefix))) continue;
    const implementation = cells[implementationIndex] ?? "";
    items.push({
      module,
      id,
      title: cells[titleIndex] ?? id,
      status,
      implementation,
      evidence: cells[evidenceIndex] ?? "—",
      paths: extractDeclaredPaths(line),
    });
  }
  return { modules, items };
}

export function parseReactRoutes(source) {
 const routes = [];
 const pattern = /<Route\s+path=["']([^"']+)["']/gu;
 for (const match of source.matchAll(pattern)) {
   if (!routes.includes(match[1])) routes.push(match[1]);
 }
 return routes;
}

export function parseExpressRoutes(source) {
  const routes = [];
  const pattern = /app\.(?:get|post|patch|put|delete)\(\s*["']([^"']+)["']/gu;
  for (const match of source.matchAll(pattern)) {
    if (!routes.includes(match[1])) routes.push(match[1]);
  }
  return routes;
}

export function parseExpressEndpoints(source) {
  const endpoints = [];
  const pattern = /app\.(get|post|patch|put|delete)\(\s*["']([^"']+)["']/gu;
  for (const match of source.matchAll(pattern)) {
    endpoints.push({ method: match[1].toUpperCase(), path: match[2] });
  }
  return endpoints;
}

export function parseGatewayEndpoints(appSource, authSource, portsSource) {
  const endpoints = [...parseExpressEndpoints(appSource)];
  if (/req\.path === "\/login"[\s\S]*req\.method === "GET"/u.test(authSource)) {
    endpoints.push({ method: "GET", path: "/login" });
  }
  if (/req\.path === "\/login"[\s\S]*req\.method === "POST"/u.test(authSource)) {
    endpoints.push({ method: "POST", path: "/login" });
  }
  if (/req\.path === "\/logout"[\s\S]*req\.method === "POST"/u.test(authSource)) {
    endpoints.push({ method: "POST", path: "/logout" });
  }

  const ports = parse(portsSource);
  for (const [name, value] of Object.entries(ports ?? {})) {
    if (name === "gateway") continue;
    if (value?.web) {
      endpoints.push({ method: "GET", path: `/${name}` });
      endpoints.push({ method: "ALL", path: `/${name}/*` });
    }
    if (value?.server) endpoints.push({ method: "ALL", path: `/api/${name}/*` });
  }
  return endpoints;
}

function joinRoute(...parts) {
  return `/${parts.filter(Boolean).join("/")}`.replace(/\/{2,}/gu, "/").replace(/\/$/u, "") || "/";
}

export function parseNestControllers(source) {
  const endpoints = [];
  let controllerPath;
  const controllerPattern = /@Controller(?:\(\s*(?:(?:path|value)\s*:\s*)?["'`]?([^"'`)\s]*)["'`]?\s*)?\)/u;
  const endpointPattern = /@(Get|Post|Patch|Put|Delete)(?:\(\s*(?:(?:path|value)\s*:\s*)?["'`]?([^"'`)\s]*)["'`]?\s*)?\)/u;

  for (const line of source.split("\n")) {
    const controller = line.match(controllerPattern);
    if (controller) {
      controllerPath = controller[1] ?? "";
      continue;
    }
    const endpoint = line.match(endpointPattern);
    if (!endpoint || controllerPath === undefined) continue;
    endpoints.push({
      method: endpoint[1].toUpperCase(),
      path: joinRoute(controllerPath, endpoint[2] ?? ""),
    });
  }
  return endpoints;
}

export function checkHistoricalSpecs(files) {
  const missing = [];
  for (const [file, content] of files) {
    if (content.includes("历史设计基线") || content.includes("当前设计基线")) continue;
    missing.push({ file, reason: "missing-historical-marker" });
  }
  return missing;
}

export function checkDocumentationImpact(changedFiles) {
  const files = [...new Set(changedFiles.filter(Boolean))];
  const hasInterfaceEvidence = files.some((file) => file === "docs/generated/interface-index.md" || /^docs\/code-wiki\/[^/]+\.md$/u.test(file));
  const hasFeatureEvidence = files.some((file) =>
    file === "docs/superpowers/coverage-matrix.md" ||
    file === "docs/generated/feature-map.md" ||
    /^docs\/(?:code-wiki|features)\/[^/]+\.md$/u.test(file));
  const findings = [];

  for (const file of files) {
    if (/^apps\/gateway\/src\/(?:app|routes|auth)\.ts$/u.test(file) && !hasInterfaceEvidence) {
      findings.push({ file, reason: "gateway-route-change-without-interface-doc" });
    }
    if (file === "infra/ports.yaml" && !hasInterfaceEvidence) {
      findings.push({ file, reason: "gateway-proxy-route-change-without-interface-doc" });
    }
    const app = file.match(/^apps\/([^/]+)\//u)?.[1];
    if (app) {
      if (/(?:web\/src\/App\.tsx|server\/src\/[^/]*\.controller\.ts)$/u.test(file) && !hasInterfaceEvidence) {
        findings.push({ file, reason: "route-or-controller-change-without-interface-doc" });
      }
      if (/(?:server\/src\/[^/]*(?:service|repo)\.ts|server\/migrations\/[^/]+\.sql)$/u.test(file) && !hasFeatureEvidence) {
        findings.push({ file, reason: "feature-or-schema-change-without-feature-doc" });
      }
      continue;
    }
    if (/^packages\/[^/]+\/src\//u.test(file) && !hasFeatureEvidence) {
      findings.push({ file, reason: "package-behavior-change-without-feature-doc" });
    }
  }
  return findings;
}

function appDirectories(repoRoot) {
  return readdirSync(path.join(repoRoot, "apps"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "gateway")
    .sort();
}

export function collectRepositoryFacts(repoRoot = REPO_ROOT) {
  const coverage = parseCoverageMatrix(readFileSync(path.join(repoRoot, "docs/superpowers/coverage-matrix.md"), "utf8"));
  const interfaces = appDirectories(repoRoot).map((app) => {
    const appSource = readFileSync(path.join(repoRoot, `apps/${app}/web/src/App.tsx`), "utf8");
    const controllers = readdirSync(path.join(repoRoot, `apps/${app}/server/src`))
      .filter((file) => file.endsWith(".controller.ts"))
      .sort()
      .flatMap((file) => parseNestControllers(readFileSync(path.join(repoRoot, `apps/${app}/server/src/${file}`), "utf8")));
    return {
      app,
      doc: `docs/code-wiki/${app}.md`,
      routes: parseReactRoutes(appSource),
      controllers,
    };
  });
  const gatewaySource = readFileSync(path.join(repoRoot, "apps/gateway/src/app.ts"), "utf8");
  const gatewayAuthSource = readFileSync(path.join(repoRoot, "apps/gateway/src/auth.ts"), "utf8");
  const portsSource = readFileSync(path.join(repoRoot, "infra/ports.yaml"), "utf8");
  interfaces.unshift({
    app: "gateway",
    doc: "docs/code-wiki/gateway.md",
    routes: parseExpressRoutes(gatewaySource),
    controllers: parseGatewayEndpoints(gatewaySource, gatewayAuthSource, portsSource),
  });
  return { coverage, interfaces };
}

function generatedHeader(title, description) {
  return [
    `# ${title}`,
    "",
    "> 自动生成文件：请修改事实源后运行 `pnpm docs:facts`，不要手工编辑。",
    `> ${description}`,
    "",
  ];
}

function cell(value) {
  return String(value || "—").replace(/\|/gu, "\\|");
}

export function renderFeatureMap(facts) {
  const lines = generatedHeader("MagicTools 功能索引", "事实源：docs/superpowers/coverage-matrix.md。");
  for (const module of facts.coverage.modules) {
    const items = facts.coverage.items.filter((item) => item.module === module);
    lines.push(`## ${module}`, "", "| ID | 功能 | 状态 | 代码定位 | 测试证据 |", "|---|---|---|---|---|");
    for (const item of items) {
      lines.push(`| ${item.id} | ${cell(item.title)} | ${cell(item.status)} | ${cell(item.implementation)} | ${cell(item.evidence)} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}

export function renderCoverageView(facts) {
  const byStatus = new Map();
  for (const item of facts.coverage.items) {
    const status = item.status.split(/\s+/u)[0];
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
  }
  const lines = generatedHeader("MagicTools 覆盖视图", "按模块汇总 coverage-matrix 的功能状态。");
  lines.push("## 总览", "", "| 状态 | 数量 |", "|---|---:|");
  for (const [status, count] of [...byStatus.entries()].sort()) lines.push(`| ${status} | ${count} |`);
  lines.push("", "## 模块", "", "| 模块 | 功能数 | 已实现 | 部分实现 | 未实现 | 规划未纳入 |", "|---|---:|---:|---:|---:|---:|");
  for (const module of facts.coverage.modules) {
    const items = facts.coverage.items.filter((item) => item.module === module);
    lines.push(`| ${module} | ${items.length} | ${countStatus(items, "✅")} | ${countStatus(items, "⚠️")} | ${countStatus(items, "🚫")} | ${countStatus(items, "📝")} |`);
  }
  lines.push("", "## 接口规模", "", "| 应用 | 页面路由 | 服务 API |", "|---|---:|---:|");
  for (const item of facts.interfaces) {
    lines.push(`| [${item.app}](interface-index.md#${item.app}) | ${item.routes.length} | ${item.controllers.length} |`);
  }
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}

function countStatus(items, prefix) {
  return items.filter((item) => item.status.startsWith(prefix)).length;
}

export function renderInterfaceIndex(facts) {
  const lines = generatedHeader("MagicTools 接口索引", "来自 React Route 与 Nest Controller 源码扫描；路由或接口变更后必须重新生成。");
  for (const item of facts.interfaces) {
    lines.push(`## ${item.app}`, "", `模块文档：[${item.doc}](../code-wiki/${path.basename(item.doc)})`, "");
    if (item.app === "gateway") {
      lines.push("### 入口与服务 API", "", "| 方法 | 路径 |", "|---|---|");
      for (const endpoint of item.controllers) lines.push(`| ${endpoint.method} | \`${endpoint.path}\` |`);
      lines.push("");
      continue;
    }
    lines.push("### 页面路由", "", "| 路由 |", "|---|");
    for (const route of item.routes) lines.push(`| \`${route}\` |`);
    lines.push("", "### 服务 API", "", "| 方法 | 路径 |", "|---|---|");
    for (const endpoint of item.controllers) lines.push(`| ${endpoint.method} | \`/api/${item.app}${endpoint.path}\` |`);
    lines.push("");
  }
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}

export function renderRepositoryDocs(facts) {
  return new Map([
    [GENERATED_FILES[0], renderFeatureMap(facts)],
    [GENERATED_FILES[1], renderCoverageView(facts)],
    [GENERATED_FILES[2], renderInterfaceIndex(facts)],
  ]);
}

function specFiles(repoRoot) {
  return readdirSync(path.join(repoRoot, "docs/superpowers/specs"))
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .sort()
    .map((file) => [file, readFileSync(path.join(repoRoot, "docs/superpowers/specs", file), "utf8")]);
}

export function validateRepository(repoRoot = REPO_ROOT) {
  const facts = collectRepositoryFacts(repoRoot);
  const rendered = renderRepositoryDocs(facts);
  const errors = [];
  for (const item of facts.interfaces) {
    if (!existsSync(path.join(repoRoot, item.doc))) errors.push(`${item.doc} does not exist`);
    if (item.routes.length === 0) errors.push(`${item.app} has no frontend routes`);
    if (item.app !== "gateway" && item.controllers.length === 0) errors.push(`${item.app} has no server controllers`);
  }
  for (const [file, content] of rendered) {
    const target = path.join(repoRoot, file);
    if (!existsSync(target)) {
      errors.push(`${file} is missing`);
      continue;
    }
    if (readFileSync(target, "utf8") !== content) errors.push(`${file} is stale`);
  }
  for (const finding of checkHistoricalSpecs(specFiles(repoRoot))) {
    errors.push(`${finding.file}: ${finding.reason}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, generated: GENERATED_FILES };
}

export function generateRepository(repoRoot = REPO_ROOT) {
  const facts = collectRepositoryFacts(repoRoot);
  const rendered = renderRepositoryDocs(facts);
  for (const [file, content] of rendered) {
    const target = path.join(repoRoot, path.dirname(file));
    mkdirSync(target, { recursive: true });
    writeFileSync(path.join(repoRoot, file), content);
  }
  return { generated: GENERATED_FILES };
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes("--impact-files")) {
    const changed = readFileSync(0, "utf8").split(/\r?\n/u).filter(Boolean);
    const findings = checkDocumentationImpact(changed);
    if (findings.length) {
      console.error(`❌ 文档影响证据缺失：${findings.length} 项`);
      for (const finding of findings) console.error(`  - ${finding.file}: ${finding.reason}`);
      console.error("接口/路由变更需刷新 generated/interface-index.md；功能、数据契约或公共包行为变更需同步 coverage-matrix、code-wiki 或 feature 文档。");
      process.exitCode = 1;
      return;
    }
    console.log(`✅ 文档影响证据通过：${changed.length} 个变更文件`);
    return;
  }

  if (argv.includes("--impact")) {
    const value = (name) => {
      const index = argv.indexOf(name);
      return index >= 0 ? argv[index + 1] : undefined;
    };
    const base = value("--base");
    const head = value("--head") ?? "HEAD";
    if (!base) throw new Error("文档影响检查必须提供 --base");
    const changed = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], { cwd: REPO_ROOT, encoding: "utf8" })
      .split(/\r?\n/u)
      .filter(Boolean);
    const findings = checkDocumentationImpact(changed);
    if (findings.length) {
      console.error(`❌ 文档影响证据缺失：${findings.length} 项`);
      for (const finding of findings) console.error(`  - ${finding.file}: ${finding.reason}`);
      console.error("接口/路由变更需刷新 generated/interface-index.md；功能、数据契约或公共包行为变更需同步 coverage-matrix、code-wiki 或 feature 文档。");
      process.exitCode = 1;
      return;
    }
    console.log(`✅ 文档影响证据通过：${changed.length} 个变更文件`);
    return;
  }

  if (argv.includes("--check")) {
    const result = validateRepository();
    if (!result.ok) {
      console.error(`❌ 文档事实漂移：${result.errors.length} 项`);
      for (const error of result.errors) console.error(`  - ${error}`);
      console.error("请运行 pnpm docs:facts 并随代码变更提交生成文档。");
      process.exitCode = 1;
      return;
    }
    console.log("✅ 文档事实守卫通过：功能映射、接口索引与生成文档一致");
    return;
  }
  const { generated } = generateRepository();
  console.log(`✅ 已生成文档事实：${generated.join(", ")}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
