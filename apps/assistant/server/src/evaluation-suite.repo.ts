import { pool } from "./db";
import type { EvaluationCaseType, EvaluationItemStatus, EvaluationSplit } from "./evaluation-scoring";

export interface EvaluationCaseRow {
  id: string;
  caseKey: string;
  caseType: EvaluationCaseType;
  split: EvaluationSplit;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  expected: Record<string, unknown>;
  enabled: boolean;
  datasetVersion: number;
}

export interface EvaluationRunRow {
  id: string;
  label: string;
  split: EvaluationSplit;
  datasetFingerprint: string;
  configSnapshot: Record<string, unknown>;
  status: "running" | "completed" | "failed" | "interrupted";
  expectedTotal: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  timeoutCount: number;
  missingCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface EvaluationRunItemRow {
  id: string;
  runId: string;
  caseId: string;
  caseKey: string;
  caseType: EvaluationCaseType;
  status: EvaluationItemStatus;
  latencyMs: number;
  actual: Record<string, unknown>;
  expected: Record<string, unknown>;
  reason: string;
  createdAt: string;
}

function mapCase(row: Record<string, unknown>): EvaluationCaseRow {
  return {
    id: row.id as string,
    caseKey: row.case_key as string,
    caseType: row.case_type as EvaluationCaseType,
    split: row.split as EvaluationSplit,
    message: row.message as string,
    history: (row.history ?? []) as EvaluationCaseRow["history"],
    expected: (row.expected ?? {}) as Record<string, unknown>,
    enabled: Boolean(row.enabled),
    datasetVersion: Number(row.dataset_version),
  };
}

function mapRun(row: Record<string, unknown>): EvaluationRunRow {
  return {
    id: row.id as string,
    label: row.label as string,
    split: row.split as EvaluationSplit,
    datasetFingerprint: row.dataset_fingerprint as string,
    configSnapshot: (row.config_snapshot ?? {}) as Record<string, unknown>,
    status: row.status as EvaluationRunRow["status"],
    expectedTotal: Number(row.expected_total),
    passCount: Number(row.pass_count),
    failCount: Number(row.fail_count),
    errorCount: Number(row.error_count),
    timeoutCount: Number(row.timeout_count),
    missingCount: Number(row.missing_count),
    error: (row.error as string | null) ?? null,
    startedAt: new Date(row.started_at as string).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at as string).toISOString() : null,
  };
}

function mapItem(row: Record<string, unknown>): EvaluationRunItemRow {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    caseId: row.case_id as string,
    caseKey: row.case_key as string,
    caseType: row.case_type as EvaluationCaseType,
    status: row.status as EvaluationItemStatus,
    latencyMs: Number(row.latency_ms),
    actual: (row.actual ?? {}) as Record<string, unknown>,
    expected: (row.expected ?? {}) as Record<string, unknown>,
    reason: (row.reason as string) ?? "",
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export async function listEvaluationCases(split?: EvaluationSplit): Promise<EvaluationCaseRow[]> {
  const rows = split
    ? await pool.query("SELECT * FROM evaluation_cases WHERE enabled = true AND split = $1 ORDER BY case_key", [split])
    : await pool.query("SELECT * FROM evaluation_cases WHERE enabled = true ORDER BY case_key");
  return rows.rows.map(mapCase);
}

export async function createEvaluationRun(input: {
  split: EvaluationSplit;
  label: string;
  datasetFingerprint: string;
  configSnapshot: Record<string, unknown>;
  expectedTotal: number;
}): Promise<EvaluationRunRow> {
  const rows = await pool.query(
    `INSERT INTO evaluation_runs (label, split, dataset_fingerprint, config_snapshot, expected_total)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.label, input.split, input.datasetFingerprint, JSON.stringify(input.configSnapshot), input.expectedTotal]
  );
  return mapRun(rows.rows[0]);
}

export async function getEvaluationRun(id: string): Promise<EvaluationRunRow | null> {
  const rows = await pool.query("SELECT * FROM evaluation_runs WHERE id = $1", [id]);
  return rows.rows[0] ? mapRun(rows.rows[0]) : null;
}

export async function listEvaluationRuns(limit = 20): Promise<EvaluationRunRow[]> {
  const rows = await pool.query("SELECT * FROM evaluation_runs ORDER BY started_at DESC LIMIT $1", [limit]);
  return rows.rows.map(mapRun);
}

export async function listEvaluationRunItems(runId: string): Promise<EvaluationRunItemRow[]> {
  const rows = await pool.query("SELECT * FROM evaluation_run_items WHERE run_id = $1 ORDER BY case_key", [runId]);
  return rows.rows.map(mapItem);
}

export async function insertEvaluationRunItem(input: {
  runId: string;
  caseId: string;
  caseKey: string;
  caseType: EvaluationCaseType;
  status: EvaluationItemStatus;
  latencyMs: number;
  actual: Record<string, unknown>;
  expected: Record<string, unknown>;
  reason: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO evaluation_run_items (run_id, case_id, case_key, case_type, status, latency_ms, actual, expected, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (run_id, case_id) DO UPDATE SET
       status = EXCLUDED.status,
       latency_ms = EXCLUDED.latency_ms,
       actual = EXCLUDED.actual,
       expected = EXCLUDED.expected,
       reason = EXCLUDED.reason`,
    [
      input.runId,
      input.caseId,
      input.caseKey,
      input.caseType,
      input.status,
      input.latencyMs,
      JSON.stringify(input.actual),
      JSON.stringify(input.expected),
      input.reason,
    ]
  );
}

export async function touchEvaluationRun(id: string): Promise<void> {
  await pool.query("UPDATE evaluation_runs SET heartbeat_at = now() WHERE id = $1", [id]);
}

export async function listMissingCaseIds(
  runId: string,
  cases: EvaluationCaseRow[]
): Promise<Array<{ id: string; caseKey: string; caseType: EvaluationCaseType; expected: Record<string, unknown> }>> {
  const rows = await pool.query("SELECT case_id FROM evaluation_run_items WHERE run_id = $1", [runId]);
  const existing = new Set(rows.rows.map((row) => row.case_id as string));
  return cases
    .filter((item) => !existing.has(item.id))
    .map((item) => ({ id: item.id, caseKey: item.caseKey, caseType: item.caseType, expected: item.expected }));
}

export async function recoverAbandonedEvaluationRuns(staleMs: number): Promise<number> {
  const rows = await pool.query(
    `UPDATE evaluation_runs
     SET status = 'interrupted', error = '评测执行中断，缺少最终 run 明细', finished_at = now()
     WHERE status = 'running' AND heartbeat_at < now() - ($1::bigint * interval '1 millisecond')`,
    [staleMs]
  );
  return rows.rowCount ?? 0;
}

export async function finishEvaluationRun(id: string, expectedTotal: number): Promise<EvaluationRunRow | null> {
  const rows = await pool.query(
    `WITH counts AS (
       SELECT
         count(*)::int AS item_count,
         count(*) FILTER (WHERE status = 'pass')::int AS pass_count,
         count(*) FILTER (WHERE status = 'fail')::int AS fail_count,
         count(*) FILTER (WHERE status = 'error')::int AS error_count,
         count(*) FILTER (WHERE status = 'timeout')::int AS timeout_count,
         count(*) FILTER (WHERE status = 'missing')::int AS missing_count
       FROM evaluation_run_items WHERE run_id = $1
     )
     UPDATE evaluation_runs r SET
       pass_count = counts.pass_count,
       fail_count = counts.fail_count,
       error_count = counts.error_count,
       timeout_count = counts.timeout_count,
       missing_count = counts.missing_count,
       status = 'completed',
       finished_at = now()
     FROM counts
     WHERE r.id = $1 AND counts.item_count = $2 RETURNING r.*`,
    [id, expectedTotal]
  );
  return rows.rows[0] ? mapRun(rows.rows[0]) : null;
}

export async function failEvaluationRun(id: string, error: unknown): Promise<void> {
  await pool.query("UPDATE evaluation_runs SET status = 'failed', error = $2, finished_at = now() WHERE id = $1", [
    id,
    error instanceof Error ? error.message : String(error),
  ]);
}
