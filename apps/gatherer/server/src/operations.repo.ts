import { pool } from "./db";

export interface DeadLetterRow {
  id: string;
  sourceId: string;
  runId: string;
  error: string;
  maxAttempts: number;
  status: string;
  attempts: number;
  lastError: string | null;
  occurredAt: string;
}

function mapRow(row: Record<string, unknown>): DeadLetterRow {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id as string,
    sourceId: (payload.sourceId as string) ?? "",
    runId: (payload.runId as string) ?? "",
    error: (payload.error as string) ?? "",
    maxAttempts: Number(payload.maxAttempts ?? 0),
    status: row.status as string,
    attempts: Number(row.attempts ?? 0),
    lastError: (row.last_error as string | null) ?? null,
    occurredAt: new Date(row.occurred_at as string).toISOString(),
  };
}

export async function listDeadLetters(limit = 50): Promise<DeadLetterRow[]> {
  const rows = await pool.query(
    `SELECT id, status, attempts, last_error, occurred_at, payload
     FROM outbox
     WHERE event = 'gatherer.collect.dead_letter'
     ORDER BY occurred_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows.rows.map(mapRow);
}
