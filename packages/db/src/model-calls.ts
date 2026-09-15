import type { Pool } from "pg";

export type ModelCallOperation = "chat" | "chat-stream" | "embedding";
export type ModelCallStatus = "success" | "error" | "timeout" | "cancelled";
export type ModelTokenSource = "provider" | "unknown";

export interface PersistableModelCall {
  id: string;
  service: string;
  operation: ModelCallOperation;
  provider: string;
  requestedModel?: string | null;
  effectiveModel: string;
  status: ModelCallStatus;
  attempt: number;
  attempts: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  tokenSource: ModelTokenSource;
  latencyMs: number;
  taskId?: string | null;
  traceId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  cancelled: boolean;
  context?: Record<string, unknown>;
}

export async function recordModelCall(pool: Pool, call: PersistableModelCall): Promise<void> {
  await pool.query(
    `INSERT INTO model_calls (
      id, service, operation, provider, requested_model, effective_model,
      status, attempt, attempts, input_tokens, output_tokens, token_source,
      latency_ms, task_id, trace_id, error_code, error_message, cancelled, context
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
    ) ON CONFLICT (id) DO NOTHING`,
    [
      call.id,
      call.service,
      call.operation,
      call.provider,
      call.requestedModel ?? null,
      call.effectiveModel,
      call.status,
      call.attempt,
      call.attempts,
      call.inputTokens ?? null,
      call.outputTokens ?? null,
      call.tokenSource,
      call.latencyMs,
      call.taskId ?? null,
      call.traceId ?? null,
      call.errorCode ?? null,
      call.errorMessage ?? null,
      call.cancelled,
      JSON.stringify(call.context ?? {}),
    ]
  );
}
