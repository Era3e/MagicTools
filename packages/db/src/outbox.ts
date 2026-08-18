import type { Pool } from "pg";
import type { DataEnvelope } from "@mt/types";

export async function appendOutbox(pool: Pool, event: DataEnvelope<unknown>): Promise<void> {
  await pool.query(
    "INSERT INTO outbox (id, event, source, payload, occurred_at, status) VALUES ($1, $2, $3, $4, $5, 'pending') ON CONFLICT (id) DO NOTHING",
    [event.id, event.event, event.source, JSON.stringify(event.payload), event.occurredAt]
  );
}

export interface ProcessOutboxOptions {
  batchSize?: number;
  maxAttempts?: number;
}

export async function processOutbox(
  pool: Pool,
  handler: (event: DataEnvelope<unknown>) => Promise<void>,
  options: ProcessOutboxOptions = {}
): Promise<number> {
  const batchSize = options.batchSize ?? 10;
  const maxAttempts = options.maxAttempts ?? 5;
  const rows = await pool.query(
    "SELECT * FROM outbox WHERE status IN ('pending', 'retry') AND attempts < $1 ORDER BY occurred_at LIMIT $2 FOR UPDATE SKIP LOCKED",
    [maxAttempts, batchSize]
  );
  let handled = 0;
  for (const row of rows.rows) {
    const event: DataEnvelope<unknown> = {
      id: row.id,
      event: row.event,
      source: row.source,
      payload: row.payload,
      occurredAt: new Date(row.occurred_at).toISOString(),
    };
    try {
      await handler(event);
      await pool.query("UPDATE outbox SET status = 'done', processed_at = now() WHERE id = $1", [row.id]);
    } catch (err) {
      await pool.query(
        "UPDATE outbox SET status = 'retry', attempts = attempts + 1, last_error = $2 WHERE id = $1",
        [row.id, String(err).slice(0, 500)]
      );
    }
    handled += 1;
  }
  return handled;
}
