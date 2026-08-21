/** 解析 LLM 输出：整段 → 去代码围栏 → 提取首个 {...} 块，逐级降级 */
export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // 继续降级
  }
  const fenced = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
  try {
    return JSON.parse(fenced);
  } catch {
    // 继续降级
  }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("LLM 输出无法解析为 JSON");
  return JSON.parse(m[0]);
}
