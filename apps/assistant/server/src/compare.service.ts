/** 数值提取与双路比对（spec §5）：纯函数，无 IO */
const NUM_RE = /(-?\d[\d,]*(?:\.\d+)?)\s*(万|亿|k|K|%|元|人|次|单|个)?/g;
const UNIT_FACTOR: Record<string, number> = { 万: 1e4, 亿: 1e8, k: 1e3, K: 1e3, "%": 0.01 };

export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(NUM_RE)) {
    const n = Number(m[1].replace(/,/g, ""));
    const factor = m[2] ? UNIT_FACTOR[m[2]] ?? 1 : 1;
    if (Number.isFinite(n)) out.push(n * factor);
  }
  return out;
}

export type CompareStatus = "consistent" | "divergent" | "unverifiable";

export interface CompareResult {
  status: CompareStatus;
  agentNumbers: number[];
  diffPct?: number;
}

export function compareValues(direct: number, agentNumbers: number[], tolerance = 0.01): CompareResult {
  if (agentNumbers.length === 0) return { status: "unverifiable", agentNumbers };
  const base = Math.max(Math.abs(direct), 1);
  const diffs = agentNumbers.map((a) => Math.abs(a - direct) / base);
  const minDiff = Math.min(...diffs);
  if (minDiff <= tolerance) return { status: "consistent", agentNumbers };
  return { status: "divergent", agentNumbers, diffPct: Math.round(minDiff * 100) };
}
