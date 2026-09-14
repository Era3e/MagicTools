import { pool } from "./db";

export type TraceStage = "routing" | "knowledge" | "action" | "data" | "trouble" | "feedback" | "other";
export type TraceStatus = "running" | "completed" | "failed" | "clarifying";

export interface TraceRow {
  id: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string | null;
  intentLogId: string | null;
  stage: TraceStage;
  status: TraceStatus;
  route: Record<string, unknown>;
  result: Record<string, unknown>;
  error: string | null;
  latencyMs: number;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): TraceRow {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    userMessageId: row.user_message_id as string,
    assistantMessageId: (row.assistant_message_id as string | null) ?? null,
    intentLogId: (row.intent_log_id as string | null) ?? null,
    stage: row.stage as TraceStage,
    status: row.status as TraceStatus,
    route: (row.route ?? {}) as Record<string, unknown>,
    result: (row.result ?? {}) as Record<string, unknown>,
    error: (row.error as string | null) ?? null,
    latencyMs: Number(row.latency_ms ?? 0),
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export async function insertTrace(input: {
  conversationId: string;
  userMessageId: string;
  assistantMessageId?: string;
  intentLogId?: string;
  stage: TraceStage;
  status: TraceStatus;
  route?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  latencyMs?: number;
}): Promise<TraceRow> {
  const rows = await pool.query(
    `INSERT INTO assistant_traces
      (conversation_id, user_message_id, assistant_message_id, intent_log_id, stage, status, route, result, error, latency_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      input.conversationId,
      input.userMessageId,
      input.assistantMessageId ?? null,
      input.intentLogId ?? null,
      input.stage,
      input.status,
      JSON.stringify(input.route ?? {}),
      JSON.stringify(input.result ?? {}),
      input.error ?? null,
      input.latencyMs ?? 0,
    ]
  );
  return mapRow(rows.rows[0]);
}
