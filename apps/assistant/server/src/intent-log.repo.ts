import { pool } from "./db";
import type { Domain, Intent } from "./llm";

export interface IntentLogRow {
  id: string;
  message: string;
  domain: string;
  intent: string;
  confidence: number;
  correctedIntent: string | null;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): IntentLogRow {
  return {
    id: r.id as string,
    message: r.message as string,
    domain: r.domain as string,
    intent: r.intent as string,
    confidence: Number(r.confidence),
    correctedIntent: (r.corrected_intent as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function insertIntentLog(input: { message: string; domain: Domain; intent: Intent; confidence: number }): Promise<IntentLogRow> {
  const rows = await pool.query(
    "INSERT INTO intent_logs (message, domain, intent, confidence) VALUES ($1, $2, $3, $4) RETURNING id, message, domain, intent, confidence, corrected_intent, created_at",
    [input.message, input.domain, input.intent, input.confidence]
  );
  return mapRow(rows.rows[0]);
}

export async function listIntentLogs(filters: { domain?: string; intent?: string } = {}, limit = 200): Promise<IntentLogRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.domain) { params.push(filters.domain); where.push("domain = $" + params.length); }
  if (filters.intent) { params.push(filters.intent); where.push("intent = $" + params.length); }
  params.push(limit);
  const rows = await pool.query(
    "SELECT id, message, domain, intent, confidence, corrected_intent, created_at FROM intent_logs" +
      (where.length ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY created_at DESC LIMIT $" + params.length,
    params
  );
  return rows.rows.map(mapRow);
}

export async function correctIntentLog(id: string, correctedIntent: string): Promise<IntentLogRow | null> {
  const rows = await pool.query(
    "UPDATE intent_logs SET corrected_intent = $2 WHERE id = $1 RETURNING id, message, domain, intent, confidence, corrected_intent, created_at",
    [id, correctedIntent]
  );
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

/** D-09: 拉取已纠错样本（corrected_intent 非空），用于 few-shot 构造与数据集导出 */
export async function listCorrectedLogs(limit = 500): Promise<IntentLogRow[]> {
  const rows = await pool.query(
    "SELECT id, message, domain, intent, confidence, corrected_intent, created_at FROM intent_logs" +
      " WHERE corrected_intent IS NOT NULL AND corrected_intent <> ''" +
      " ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return rows.rows.map(mapRow);
}

/** D-09: 统计路由表现（真值 = corrected_intent ?? intent），供混淆矩阵与趋势观测 */
export async function intentStats(): Promise<Array<{ intent: string; total: number; corrected: number }>> {
  const rows = await pool.query(
    "SELECT intent, COUNT(*)::int AS total, COUNT(corrected_intent)::int AS corrected FROM intent_logs GROUP BY intent ORDER BY total DESC"
  );
  return rows.rows.map((r: Record<string, unknown>) => ({
    intent: r.intent as string,
    total: r.total as number,
    corrected: r.corrected as number,
  }));
}

/** D-09: 混淆对（predicted × actual），仅统计已纠错样本 */
export async function intentConfusion(): Promise<Array<{ predicted: string; actual: string; count: number }>> {
  const rows = await pool.query(
    "SELECT intent AS predicted, corrected_intent AS actual, COUNT(*)::int AS count FROM intent_logs" +
      " WHERE corrected_intent IS NOT NULL AND corrected_intent <> ''" +
      " GROUP BY intent, corrected_intent ORDER BY count DESC"
  );
  return rows.rows.map((r: Record<string, unknown>) => ({
    predicted: r.predicted as string,
    actual: r.actual as string,
    count: r.count as number,
  }));
}
