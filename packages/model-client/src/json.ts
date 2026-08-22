/** 给无引号键补引号（模型可能返回 {domain: "x"} 这类非法 JSON） */
function quoteKeys(s: string): string {
  return s.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
}

/** 解析 LLM 输出：补引号 → 整段 → 去代码围栏 → 提取首个 {...} 块，逐级降级 */
export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(quoteKeys(raw));
  } catch {
    // 继续降级
  }
  const fenced = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
  try {
    return JSON.parse(quoteKeys(fenced));
  } catch {
    // 继续降级
  }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("LLM 输出无法解析为 JSON");
  return JSON.parse(quoteKeys(m[0]));
}
