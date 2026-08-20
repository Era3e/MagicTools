/** 解析 LLM 输出：先整段 JSON.parse，失败则提取首个 {...} 块 */
export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("LLM 输出无法解析为 JSON");
    return JSON.parse(m[0]);
  }
}
