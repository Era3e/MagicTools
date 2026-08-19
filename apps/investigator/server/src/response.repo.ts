import { pool } from "./db";

export interface ResponseRow {
  id: string;
  surveyId: string;
  recordId: string;
  rawFields: Record<string, string[]>;
  structured: Record<string, unknown>;
  sentiment: string;
  priority: string;
  summary: string;
  pushedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): ResponseRow {
  return {
    id: r.id as string,
    surveyId: r.survey_id as string,
    recordId: r.record_id as string,
    rawFields: (r.raw_fields as Record<string, string[]>) ?? {},
    structured: (r.structured as Record<string, unknown>) ?? {},
    sentiment: r.sentiment as string,
    priority: r.priority as string,
    summary: r.summary as string,
    pushedAt: r.pushed_at ? new Date(r.pushed_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listResponses(surveyId: string, filters: { sentiment?: string; priority?: string } = {}): Promise<ResponseRow[]> {
  const where: string[] = ["survey_id = $1"];
  const params: unknown[] = [surveyId];
  if (filters.sentiment) { params.push(filters.sentiment); where.push("sentiment = $" + params.length); }
  if (filters.priority) { params.push(filters.priority); where.push("priority = $" + params.length); }
  const rows = await pool.query("SELECT * FROM responses WHERE " + where.join(" AND ") + " ORDER BY created_at ASC", params);
  return rows.rows.map(mapRow);
}

export async function upsertResponse(input: {
  surveyId: string;
  recordId: string;
  rawFields: Record<string, string[]>;
  structured: Record<string, unknown>;
  sentiment: string;
  priority: string;
  summary: string;
}): Promise<void> {
  await pool.query(
    "INSERT INTO responses (survey_id, record_id, raw_fields, structured, sentiment, priority, summary) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (survey_id, record_id) DO UPDATE SET raw_fields = EXCLUDED.raw_fields, structured = EXCLUDED.structured, sentiment = EXCLUDED.sentiment, priority = EXCLUDED.priority, summary = EXCLUDED.summary, updated_at = now()",
    [input.surveyId, input.recordId, JSON.stringify(input.rawFields), JSON.stringify(input.structured), input.sentiment, input.priority, input.summary]
  );
}

export async function markPushed(id: string): Promise<void> {
  await pool.query("UPDATE responses SET pushed_at = now() WHERE id = $1", [id]);
}

export async function startSyncRun(surveyId: string): Promise<string> {
  const rows = await pool.query("INSERT INTO sync_runs (survey_id) VALUES ($1) RETURNING id", [surveyId]);
  return rows.rows[0].id as string;
}

export async function finishSyncRun(runId: string, stats: { fetchedCount: number; processedCount: number; error?: string }): Promise<void> {
  await pool.query(
    "UPDATE sync_runs SET finished_at = now(), fetched_count = $2, processed_count = $3, error = $4 WHERE id = $1",
    [runId, stats.fetchedCount, stats.processedCount, stats.error ?? null]
  );
}

export async function touchSurveySyncedAt(surveyId: string): Promise<void> {
  await pool.query("UPDATE surveys SET last_synced_at = now() WHERE id = $1", [surveyId]);
}
