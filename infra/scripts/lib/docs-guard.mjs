import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * 从 coverage-matrix 表格行提取「声明的仓库路径」token。
 * 仅提取以仓库顶层目录开头的全路径（apps/ packages/ e2e/ infra/ .githooks/）——
 * 子项目相对简写（server/xxx.ts、web/pages/xxx.tsx、pages/xxx.tsx）的归属需章节上下文才能判定，
 * 裸文件名与 @mt/* 包引用同样不可判定，均跳过。
 */
const REPO_PREFIX = /^(apps|packages|e2e|infra|\.githooks)\//;

export function extractDeclaredPaths(line) {
  const tokens = line.match(/[A-Za-z0-9_.\-/]+\.[A-Za-z0-9]+/g) ?? [];
  return tokens.filter((t) => REPO_PREFIX.test(t));
}

/**
 * 校验 coverage-matrix：✅ 行声明的仓库路径必须真实存在（drift guard）。
 * @param {string} md coverage-matrix.md 全文
 * @param {(p: string) => boolean} existsFn 路径存在性谓词（注入以便测试）
 * @returns {{line: number, path: string, snippet: string}[]} 缺失清单；空数组 = 通过
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
  }
  );
  return missing;
}

function exists(p) {
  try {
    readFileSync(path.join(REPO_ROOT, p));
    return true;
  } catch {
    return false;
  }
}

/** CLI 入口：pnpm test:infra 或 CI 直接调用；发现漂移即非零退出 */
export function main() {
  const md = readFileSync(path.join(REPO_ROOT, "docs/superpowers/coverage-matrix.md"), "utf8");
  const missing = checkCoverageMatrix(md, exists);
  if (missing.length > 0) {
    console.error(`❌ coverage-matrix drift：${missing.length} 处 ✅ 行声明的路径在仓库中不存在：`);
    for (const m of missing) {
      console.error(`  L${m.line}: ${m.path}`);
      console.error(`    ${m.snippet}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`✅ coverage-matrix drift guard 通过：✅ 行声明的仓库路径全部存在`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
