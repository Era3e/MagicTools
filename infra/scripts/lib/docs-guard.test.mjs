import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractDeclaredPaths, checkCoverageMatrix, checkMarkdownLinks, extractMarkdownTargets } from "./docs-guard.mjs";

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

test("checkMarkdownLinks 校验仓库内相对链接并解码 URI", () => {
  const md = [
    "# 文档",
    "",
    "[存在](../features/exists.md)",
    "[目录](../features)",
    "[中文](../features/%E4%B8%AD%E6%96%87.md)",
    "[缺失](../features/missing.md)",
  ].join("\n");
  const source = path.join(root, "docs/code-wiki/example.md");
  const missing = checkMarkdownLinks(md, source, (target) => {
    const normalized = target.replaceAll(path.sep, "/");
    return normalized.endsWith("/features/exists.md") ||
      normalized.endsWith("/features") ||
      normalized.endsWith("/features/中文.md");
  });

  assert.equal(missing.length, 1);
  assert.equal(missing[0].line, 6);
  assert.equal(missing[0].target, "../features/missing.md");
});

test("checkMarkdownLinks 跳过外部链接、纯锚点和 mailto", () => {
  const md = [
    "[web](https://example.com/a.md)",
    "[mail](mailto:a@example.com)",
    "[anchor](#section)",
    "[local](../features/exists.md)",
  ].join("\n");
  const source = path.join(root, "docs/code-wiki/example.md");
  const missing = checkMarkdownLinks(md, source, () => true);

  assert.deepEqual(missing, []);
});

test("extractMarkdownTargets 跳过代码块和行内代码", () => {
  const md = [
    "```md",
    "[missing](missing.md)",
    "```",
    "",
    "`[missing](missing.md)`",
    "[exists](../features/exists.md)",
  ].join("\n");

  assert.deepEqual(extractMarkdownTargets(md), [{ line: 6, target: "../features/exists.md" }]);
});

test("extractMarkdownTargets 支持 reference、HTML 与完整 destination 语法", () => {
  const md = [
    "[reference]: ./missing-reference.md",
    "<a href='./missing-html.md'>link</a>",
    "[angle](<./missing angle.md>)",
    "[balanced](./a(b).md)",
  ].join("\n");

  assert.deepEqual(extractMarkdownTargets(md), [
    { line: 1, target: "./missing-reference.md" },
    { line: 2, target: "./missing-html.md" },
    { line: 3, target: "./missing angle.md" },
    { line: 4, target: "./a(b).md" },
  ]);
});

test("活守卫：真实 docs Markdown 的仓库内相对链接全部存在", () => {
  const broken = [];
  for (const file of walkDocs(path.join(root, "docs"))) {
    const missing = checkMarkdownLinks(readFileSync(file, "utf8"), file, (target) => {
      try {
        statSync(target);
        return true;
      } catch {
        return false;
      }
    });
    broken.push(...missing);
  }

  assert.deepEqual(broken, [], `docs 中损坏的相对链接：${JSON.stringify(broken, null, 2)}`);
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

function walkDocs(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDocs(current, files);
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(current);
  }
  return files;
}
