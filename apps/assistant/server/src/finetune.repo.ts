import { pool } from "./db";

export interface FinetuneJobRow {
  id: string;
  remoteJobId: string;
  remoteFileId: string;
  baseModel: string;
  sampleCount: number;
  status: string;
  fineTunedModel: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): FinetuneJobRow {
  return {
    id: r.id as string,
    remoteJobId: r.remote_job_id as string,
    remoteFileId: r.remote_file_id as string,
    baseModel: r.base_model as string,
    sampleCount: Number(r.sample_count),
    status: r.status as string,
    fineTunedModel: (r.fine_tuned_model as string | null) ?? null,
    error: (r.error as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

const COLUMNS = "id, remote_job_id, remote_file_id, base_model, sample_count, status, fine_tuned_model, error, created_at, updated_at";

export async function insertFinetuneJob(input: { remoteJobId: string; remoteFileId: string; baseModel: string; sampleCount: number }): Promise<FinetuneJobRow> {
  const rows = await pool.query(
    "INSERT INTO finetune_jobs (remote_job_id, remote_file_id, base_model, sample_count) VALUES ($1, $2, $3, $4) RETURNING " + COLUMNS,
    [input.remoteJobId, input.remoteFileId, input.baseModel, input.sampleCount]
  );
  return mapRow(rows.rows[0]);
}

export async function listFinetuneJobs(limit = 20): Promise<FinetuneJobRow[]> {
  const rows = await pool.query("SELECT " + COLUMNS + " FROM finetune_jobs ORDER BY created_at DESC LIMIT $1", [limit]);
  return rows.rows.map(mapRow);
}

export async function getLatestFinetuneJob(): Promise<FinetuneJobRow | null> {
  const rows = await pool.query("SELECT " + COLUMNS + " FROM finetune_jobs ORDER BY created_at DESC LIMIT 1");
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function updateFinetuneJob(id: string, patch: { status?: string; fineTunedModel?: string | null; error?: string | null }): Promise<FinetuneJobRow | null> {
  const rows = await pool.query(
    "UPDATE finetune_jobs SET status = COALESCE($2, status), fine_tuned_model = COALESCE($3, fine_tuned_model), error = $4, updated_at = now() WHERE id = $1 RETURNING " + COLUMNS,
    [id, patch.status ?? null, patch.fineTunedModel ?? null, patch.error ?? null]
  );
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function hasRunningFinetuneJob(): Promise<boolean> {
  const rows = await pool.query("SELECT 1 FROM finetune_jobs WHERE status IN ('created', 'running') LIMIT 1");
  return rows.rowCount !== null && rows.rowCount > 0;
}
