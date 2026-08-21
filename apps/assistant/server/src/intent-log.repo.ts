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
