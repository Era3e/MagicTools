import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractDeclaredPaths, checkCoverageMatrix } from "./docs-guard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("extractDeclaredPaths 提取带仓库前缀的路径 token", () => {
  const line =
    "| I3 | 定时拉取 | spec 3.2 | server/survey.service.ts + apps/investigator/server/src/scheduler.ts（node-cron，migrations/003） | ✅ 已实现 | investigator.spec.ts |";
  assert.deepEqual(extractDeclaredPaths(line), ["apps/investigator/server/src/scheduler.ts"]);
});

test("extractDeclaredPaths 不提取裸文件名与子项目相对简写", () => {
  const bare = "| E1 | 双路查询 | spec | direct-query.service.ts + chat.service.ts | ✅ 已实现 | x |";
  assert.deepEqual(extractDeclaredPaths(bare), []);
  const shorthand = "| M4 | Webhook | spec | server/webhook.controller.ts + requirement.service.ts | ✅ 已实现 | y |";
  assert.deepEqual(extractDeclaredPaths(shorthand), []);
});

test("checkCoverageMatrix 跳过非 ✅ 行（🚫 行不校验）", () => {
  const md = [
    "| # | a | b | c | d | e |",
    "|---|---|---|---|---|---|",
    "| C10 | x | y | packages/ui/src/ThemePreview.tsx | 🚫 未实现 | — |",
    "| A2 | x | y | packages/ui/src/tokens.ts | ✅ 已实现 | t |",
  ].join("\n");
  const missing = checkCoverageMatrix(md, (p) => p === "packages/ui/src/tokens.ts");
  assert.deepEqual(missing, []);
});

test("checkCoverageMatrix 汇报缺失路径", () => {
  const md = [
    "| # | a | b | c | d | e |",
    "|---|---|---|---|---|---|",
    "| A1 | x | y | apps/nope/server/src/missing.ts | ✅ 已实现 | t |",
    "| A2 | x | y | packages/ui/src/tokens.ts | ✅ 已实现 | t |",
  ].join("\n");
  const missing = checkCoverageMatrix(md, (p) => p === "packages/ui/src/tokens.ts");
  assert.deepEqual(missing, [
    { line: 3, path: "apps/nope/server/src/missing.ts", snippet: expectSnippet(md, 3) },
  ]);
});

test("活守卫：真实 coverage-matrix ✅ 行声明的仓库路径全部存在", () => {
  const md = readFileSync(path.join(root, "docs/superpowers/coverage-matrix.md"), "utf8");
  const missing = checkCoverageMatrix(md, (p) => exists(joinRoot(p)));
  assert.deepEqual(missing, [], `coverage-matrix 声明但仓库缺失的路径：${JSON.stringify(missing, null, 2)}`);
});

function joinRoot(p) {
  return path.join(root, p);
}

function exists(p) {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}

function expectSnippet(md, lineNo) {
  return md.split("\n")[lineNo - 1]?.slice(0, 80) ?? "";
}
