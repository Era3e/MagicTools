import { pool } from "./db";

export interface SourceRow {
  id: string;
  name: string;
  type: string;
  url: string;
  cron: string;
  options: Record<string, unknown>;
  status: string;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): SourceRow {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as string,
    url: r.url as string,
    cron: r.cron as string,
    options: (r.options as Record<string, unknown>) ?? {},
    status: r.status as string,
    lastRunAt: r.last_run_at ? new Date(r.last_run_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listSources(): Promise<SourceRow[]> {
  const rows = await pool.query("SELECT * FROM sources ORDER BY updated_at DESC");
  return rows.rows.map(mapRow);
}

export async function getSource(id: string): Promise<SourceRow | null> {
  const rows = await pool.query("SELECT * FROM sources WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function createSource(input: {
  name: string;
  type?: string;
  url?: string;
  cron?: string;
  options?: Record<string, unknown>;
}): Promise<SourceRow> {
  const rows = await pool.query(
    "INSERT INTO sources (name, type, url, cron, options) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [input.name, input.type ?? "rss", input.url ?? "", input.cron ?? "", JSON.stringify(input.options ?? {})]
  );
  return mapRow(rows.rows[0]);
}

export async function updateSource(id: string, patch: {
  name?: string;
  type?: string;
  url?: string;
  cron?: string;
  options?: Record<string, unknown>;
  status?: string;
}): Promise<SourceRow | null> {
  const current = await getSource(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  const rows = await pool.query(
    "UPDATE sources SET name=$1, type=$2, url=$3, cron=$4, options=$5, status=$6, updated_at=now() WHERE id=$7 RETURNING *",
    [next.name, next.type, next.url, next.cron, JSON.stringify(next.options), next.status, id]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function touchRun(id: string): Promise<void> {
  await pool.query("UPDATE sources SET last_run_at = now() WHERE id = $1", [id]);
}
