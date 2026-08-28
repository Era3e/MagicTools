import { pool } from "./db";

export interface SurveyRow {
  id: string;
  name: string;
  description: string;
  status: string;
  source: string;
  appToken: string;
  tableId: string;
  answerFields: string[];
  summary: string | null;
  lastSyncedAt: string | null;
  cron: string;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): SurveyRow {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    status: r.status as string,
    source: r.source as string,
    appToken: r.app_token as string,
    tableId: r.table_id as string,
    answerFields: (r.answer_fields as string[]) ?? [],
    summary: (r.summary as string) ?? null,
    lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at as string).toISOString() : null,
    cron: (r.cron as string) ?? "",
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listSurveys(): Promise<SurveyRow[]> {
  const rows = await pool.query("SELECT * FROM surveys ORDER BY updated_at DESC");
  return rows.rows.map(mapRow);
}

export async function getSurvey(id: string): Promise<SurveyRow | null> {
  const rows = await pool.query("SELECT * FROM surveys WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function createSurvey(input: {
  name: string;
  description?: string;
  appToken?: string;
  tableId?: string;
  answerFields?: string[];
  cron?: string;
}): Promise<SurveyRow> {
  const rows = await pool.query(
    "INSERT INTO surveys (name, description, app_token, table_id, answer_fields, cron) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [input.name, input.description ?? "", input.appToken ?? "", input.tableId ?? "", JSON.stringify(input.answerFields ?? []), input.cron ?? ""]
  );
  return mapRow(rows.rows[0]);
}

export async function updateSurvey(id: string, patch: {
  name?: string;
  description?: string;
  status?: string;
  appToken?: string;
  tableId?: string;
  answerFields?: string[];
  summary?: string | null;
  cron?: string;
}): Promise<SurveyRow | null> {
  const current = await getSurvey(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  const rows = await pool.query(
    "UPDATE surveys SET name=$1, description=$2, status=$3, app_token=$4, table_id=$5, answer_fields=$6, summary=$7, cron=$8, updated_at=now() WHERE id=$9 RETURNING *",
    [next.name, next.description, next.status, next.appToken, next.tableId, JSON.stringify(next.answerFields), next.summary, next.cron, id]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function setSurveySummary(id: string, summary: string): Promise<void> {
  await pool.query("UPDATE surveys SET summary = $2, updated_at = now() WHERE id = $1", [id, summary]);
}
