import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const GRAPH_RULES = [
  "no-circular",
  "packages-no-apps",
  "apps-isolated",
  "no-production-to-test",
];

const WORKSPACE_PACKAGES = new Map([
  ["@mt/config", "packages/config"],
  ["@mt/types", "packages/types"],
  ["@mt/utils", "packages/utils"],
  ["@mt/db", "packages/db"],
  ["@mt/model-client", "packages/model-client"],
  ["@mt/ui", "packages/ui"],
]);

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DEPCRUISE_CLI = path.join(REPO_ROOT, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const GRAPH_OUTPUT = ".qa/code-graph/dependency-graph.json";
const DOC_OUTPUT = "docs/generated/dependency-index.md";

export function summarizeDependencyGraph(graph) {
  const modules = graph.modules ?? [];
  const workspaceEdges = new Map();
  const sourceModules = modules.filter((module) => /^(apps|packages)\//u.test(module.source));

  for (const module of modules) {
    const from = workspaceModule(module.source);
    if (!from) continue;
    for (const dependency of module.dependencies ?? []) {
      const to = workspaceModule(dependency.resolved);
      if (!to || from === to) continue;
      workspaceEdges.set(`${from}->${to}`, { from, to });
    }
  }

  return {
    sourceModuleCount: sourceModules.length,
    graphNodeCount: modules.length,
    dependencyCount: modules.reduce((total, module) => total + (module.dependencies?.length ?? 0), 0),
    moduleCount: new Set(modules.map((module) => workspaceModule(module.source)).filter(Boolean)).size,
    workspaceEdges: [...workspaceEdges.values()].sort((a, b) =>
      `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`),
    ),
    rules: [...GRAPH_RULES],
  };
}

export function renderDependencyIndex(summary) {
  const lines = [
    "# MagicTools 依赖图索引",
    "",
    "> 自动生成文件：请运行 `pnpm graph:json`，不要手工编辑。",
    "> 来自 dependency-cruiser 对 apps 与 packages 的 TS/TSX import 扫描；完整 graph JSON 只写入 .qa/code-graph/。",
    "",
    "## 总览",
    "",
    "| 指标 | 数量 |",
    "|---|---:|",
    `| 源码模块 | ${summary.sourceModuleCount} |`,
    `| Graph 节点 | ${summary.graphNodeCount} |`,
    `| 依赖边 | ${summary.dependencyCount} |`,
    `| Workspace 模块 | ${summary.moduleCount} |`,
    `| 模块级依赖边 | ${summary.workspaceEdges.length} |`,
    "",
    `守卫规则：${summary.rules.join("、")}。`,
    "",
    "## Workspace 模块依赖",
    "",
    "| 来源模块 | 依赖模块 |",
    "|---|---|",
  ];

  for (const edge of summary.workspaceEdges) lines.push(`| ${edge.from} | ${edge.to} |`);
  lines.push("");
  return lines.join("\n");
}

export function checkDependencyIndex(summary, current) {
  const expected = renderDependencyIndex(summary);
  return current === expected ? [] : [{ reason: "dependency-index-stale" }];
}

function workspaceModule(source) {
  const normalized = String(source ?? "").replaceAll(path.sep, "/");
  if (WORKSPACE_PACKAGES.has(normalized)) return WORKSPACE_PACKAGES.get(normalized);
  if (normalized.startsWith("apps/gateway/")) return "apps/gateway";
  const appMatch = normalized.match(/^apps\/([^/]+)\/(server|web)\//u);
  if (appMatch) return `apps/${appMatch[1]}/${appMatch[2]}`;
  const packageMatch = normalized.match(/^packages\/([^/]+)\//u);
  if (packageMatch) return `packages/${packageMatch[1]}`;
  return null;
}

function cruise(outputType) {
  const result = spawnSync(process.execPath, [
    DEPCRUISE_CLI,
    "apps",
    "packages",
    "--config",
    ".dependency-cruiser.cjs",
    "--output-type",
    outputType,
  ], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes("--json")) {
    const result = cruise("json");
    if (result.status !== 0) {
      process.stderr.write(result.stdout + result.stderr);
      process.exitCode = result.status ?? 1;
      return;
    }

    const graph = JSON.parse(result.stdout);
    if ((graph.summary?.error ?? 0) > 0) {
      process.stderr.write(`❌ dependency graph 存在 ${graph.summary.error} 个 error，拒绝生成索引\n`);
      process.exitCode = 1;
      return;
    }
    const summary = summarizeDependencyGraph(graph);
    mkdirSync(path.join(REPO_ROOT, path.dirname(GRAPH_OUTPUT)), { recursive: true });
    writeFileSync(path.join(REPO_ROOT, GRAPH_OUTPUT), JSON.stringify(graph, null, 2) + "\n");
    writeFileSync(path.join(REPO_ROOT, DOC_OUTPUT), renderDependencyIndex(summary));
    console.log(`✅ 已生成依赖图：${GRAPH_OUTPUT}、${DOC_OUTPUT}`);
    return;
  }

  const result = cruise("json");
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    process.exitCode = result.status ?? 1;
    return;
  }

  const graph = JSON.parse(result.stdout);
  const violations = graph.summary?.violations ?? [];
  if ((graph.summary?.error ?? 0) > 0) {
    process.stderr.write(`❌ dependency graph 存在 ${graph.summary.error} 个 error：\n`);
    for (const violation of violations) {
      process.stderr.write(`  ${violation.rule?.name}: ${violation.from} -> ${violation.to}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const summary = summarizeDependencyGraph(graph);
  const indexDrift = checkDependencyIndex(summary, readFileSync(path.join(REPO_ROOT, DOC_OUTPUT), "utf8"));
  if (indexDrift.length > 0) {
    process.stderr.write("❌ dependency graph 索引漂移：请运行 pnpm graph:json 并提交 docs/generated/dependency-index.md\n");
    process.exitCode = 1;
    return;
  }
  console.log(`✅ dependency graph guard 通过：${summary.sourceModuleCount} 个源码模块、${summary.graphNodeCount} 个graph节点、${summary.dependencyCount} 条依赖边，无违规`);
}
