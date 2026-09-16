import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * 从 coverage-matrix 表格行提取「声明的仓库路径」token。
 * 仅提取以仓库顶层目录开头的全路径（apps/ packages/ e2e/ infra/ .githooks/）；
 * 子项目相对简写、裸文件名与 @mt/* 包引用需要章节上下文才能判定，均跳过。
 */
const REPO_PREFIX = /^(apps|packages|e2e|infra|\.githooks)\//;

export function extractDeclaredPaths(line) {
  const tokens = line.match(/[A-Za-z0-9_.\-/]+\.[A-Za-z0-9]+/g) ?? [];
  return tokens.filter((t) => REPO_PREFIX.test(t));
}

/**
 * 校验 coverage-matrix：✅ 行声明的仓库路径必须真实存在。
 */
export function checkCoverageMatrix(md, existsFn) {
  const missing = [];
  md.split("\n").forEach((line, i) => {
    if (!line.includes("✅")) return;
    for (const p of extractDeclaredPaths(line)) {
      if (!existsFn(p)) {
        missing.push({ line: i + 1, path: p, snippet: line.slice(0, 80) });
      }
    }
  });
  return missing;
}

export function extractMarkdownTargets(md) {
  const targets = [];
  let fenceMarker = null;
  let indentedCodeAllowed = true;

  md.split("\n").forEach((line, index) => {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/u);
    if (fenceMarker) {
      if (fence && fence[1].startsWith(fenceMarker)) fenceMarker = null;
      return;
    }
    if (fence) {
      fenceMarker = fence[1][0].repeat(3);
      return;
    }
    if (indentedCodeAllowed && /^ {4}\S/u.test(line)) return;
    indentedCodeAllowed = line.trim() === "";

    const readable = stripInlineCode(line);
    for (const match of readable.matchAll(/<a\b[^>]*\bhref=(?:"([^"]*)"|'([^']*)')/giu)) {
      targets.push({ line: index + 1, target: match[1] ?? match[2] });
    }

    const reference = readable.match(/^ {0,3}\[[^\]]+\]:\s+(?:<([^>]*)>|(\S+))(?:\s+["'(].*)?$/u);
    if (reference) targets.push({ line: index + 1, target: reference[1] ?? reference[2] });

    let cursor = readable.indexOf("](");
    while (cursor >= 0) {
      const destination = readDestination(readable, cursor + 2);
      if (destination.target) targets.push({ line: index + 1, target: destination.target });
      cursor = readable.indexOf("](", Math.max(cursor + 1, destination.end));
    }
  });
  return targets;
}

/**
 * 校验 Markdown 中的仓库内相对链接；外部 URL、mailto 和纯锚点跳过，目录是合法目标。
 */
export function checkMarkdownLinks(md, sourceFile, existsFn) {
  const missing = [];

  for (const { line, target: rawTarget } of extractMarkdownTargets(md)) {
    if (!rawTarget || /^[a-z][a-z\d+\-.]*:/iu.test(rawTarget) || rawTarget.startsWith("#")) continue;
    const target = splitTarget(rawTarget);
    if (target && !existsFn(path.resolve(path.dirname(sourceFile), target))) {
      missing.push({ line, target: rawTarget, source: sourceFile });
    }
  }
  return missing;
}

function stripInlineCode(line) {
  return line.replace(/(`+)[\s\S]*?\1/gu, "");
}

function readDestination(line, start) {
  if (line[start] === "<") {
    const end = line.indexOf(">", start + 1);
    return end < 0 ? { target: null, end: start + 1 } : { target: line.slice(start + 1, end), end: end + 1 };
  }

  let depth = 0;
  let end = start;
  while (end < line.length) {
    const char = line[end];
    if (/\s/u.test(char)) break;
    if (char === "(") depth += 1;
    if (char === ")") {
      if (depth === 0) break;
      depth -= 1;
    }
    end += 1;
  }
  return { target: line.slice(start, end), end };
}

function splitTarget(rawTarget) {
  let decoded = rawTarget;
  try {
    decoded = decodeURIComponent(rawTarget);
  } catch {
    // 非法 URI 保留原样，由文件系统判定。
  }
  return decoded.split("#")[0].split("?")[0] || null;
}

function exists(p) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

/** CLI 入口：pnpm test:infra 或 CI 直接调用；发现漂移即非零退出。 */
export function main() {
  const failures = [];
  const coveragePath = path.join(REPO_ROOT, "docs/superpowers/coverage-matrix.md");
  const coverageMissing = checkCoverageMatrix(
    readFileSync(coveragePath, "utf8"),
    (p) => exists(path.join(REPO_ROOT, p)),
  );
  if (coverageMissing.length > 0) {
    failures.push(`coverage-matrix drift：${coverageMissing.length} 处 ✅ 行声明的路径在仓库中不存在`);
    for (const m of coverageMissing) {
      console.error(`  L${m.line}: ${m.path}`);
      console.error(`    ${m.snippet}`);
    }
  }

  const brokenLinks = [];
  for (const file of walkMarkdown(path.join(REPO_ROOT, "docs"))) {
    brokenLinks.push(...checkMarkdownLinks(readFileSync(file, "utf8"), file, exists));
  }
  if (brokenLinks.length > 0) {
    failures.push(`docs markdown link drift：${brokenLinks.length} 处仓库内相对链接不存在`);
    for (const link of brokenLinks) {
      const resolved = path.resolve(path.dirname(link.source), splitTarget(link.target));
      console.error(`  ${path.relative(REPO_ROOT, link.source)}:${link.line}: ${link.target} -> ${resolved}`);
    }
  }

  if (failures.length > 0) {
    console.error(`❌ ${failures.join("；")}`);
    process.exitCode = 1;
    return;
  }
  console.log("✅ docs drift guard 通过：coverage 路径与 Markdown 相对链接全部存在");
}

function walkMarkdown(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(current, files);
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(current);
  }
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
