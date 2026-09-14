import type { Pool } from "pg";
import type { DataEnvelope } from "@mt/types";
import { randomUUID } from "node:crypto";

export async function appendOutbox(pool: Pool, event: DataEnvelope<unknown>): Promise<void> {
  await pool.query(
    "INSERT INTO outbox (id, event, source, payload, occurred_at, status) VALUES ($1, $2, $3, $4, $5, 'pending') ON CONFLICT (id) DO NOTHING",
    [event.id, event.event, event.source, JSON.stringify(event.payload), event.occurredAt]
  );
}

export interface ProcessOutboxOptions {
  batchSize?: number;
  maxAttempts?: number;
  consumerId?: string;
  leaseMilliseconds?: number;
}

interface OutboxRow {
  id: string;
  event: string;
  source: DataEnvelope<unknown>["source"];
  payload: unknown;
  occurred_at: Date | string;
  attempts: number;
}

function toEvent(row: OutboxRow): DataEnvelope<unknown> {
  return {
    id: row.id,
    event: row.event,
    source: row.source,
    payload: row.payload,
    occurredAt: new Date(row.occurred_at).toISOString(),
  };
}

async function claimOutbox(
  pool: Pool,
  options: Required<Pick<ProcessOutboxOptions, "batchSize" | "maxAttempts" | "consumerId" | "leaseMilliseconds">>
) {
  await pool.query(
    `UPDATE outbox
     SET status='dead', locked_by=NULL, lease_expires_at=NULL,
         last_error=COALESCE(last_error, 'lease expired after max attempts')
     WHERE status='processing' AND attempts >= $1
       AND (lease_expires_at IS NULL OR lease_expires_at < now())`,
    [options.maxAttempts]
  );
  const rows = await pool.query(
    `UPDATE outbox AS target
     SET status = 'processing', attempts = target.attempts + 1,
         locked_by = $1, lease_expires_at = now() + ($2 * interval '1 millisecond')
     WHERE target.id IN (
       SELECT id FROM outbox
       WHERE (status IN ('pending', 'retry') AND attempts < $3)
          OR (status = 'processing' AND (lease_expires_at IS NULL OR lease_expires_at < now()))
       ORDER BY occurred_at
       LIMIT $4
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [options.consumerId, options.leaseMilliseconds, options.maxAttempts, options.batchSize]
  );
  return (rows.rows as OutboxRow[]).sort((a, b) =>
    new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );
}

export async function processOutbox(
  pool: Pool,
  handler: (event: DataEnvelope<unknown>) => Promise<void>,
  options: ProcessOutboxOptions = {}
): Promise<number> {
  const claimOptions = {
    batchSize: options.batchSize ?? 10,
    maxAttempts: options.maxAttempts ?? 5,
    consumerId: options.consumerId ?? randomUUID(),
    leaseMilliseconds: options.leaseMilliseconds ?? 60_000,
  };
  const rows = await claimOutbox(pool, claimOptions);
  let handled = 0;
  for (const row of rows) {
    const event = toEvent(row);
    try {
      await handler(event);
      await pool.query(
        "UPDATE outbox SET status = 'done', processed_at = now(), locked_by = NULL, lease_expires_at = NULL WHERE id = $1 AND status = 'processing' AND locked_by = $2",
        [row.id, claimOptions.consumerId]
      );
    } catch (err) {
      // 达到最大重试次数后进入 dead 终态，避免永久停在 retry
      const attempts = Number(row.attempts);
      const status = attempts >= claimOptions.maxAttempts ? "dead" : "retry";
      await pool.query(
        "UPDATE outbox SET status = $2, attempts = $3, last_error = $4, locked_by = NULL, lease_expires_at = NULL WHERE id = $1 AND status = 'processing' AND locked_by = $5",
        [row.id, status, attempts, String(err).slice(0, 500), claimOptions.consumerId]
      );
    }
    handled += 1;
  }
  return handled;
}

export async function processOutboxBatch(
  pool: Pool,
  handler: (events: DataEnvelope<unknown>[]) => Promise<void>,
  options: ProcessOutboxOptions = {}
): Promise<number> {
  const claimOptions = {
    batchSize: options.batchSize ?? 10,
    maxAttempts: options.maxAttempts ?? 5,
    consumerId: options.consumerId ?? randomUUID(),
    leaseMilliseconds: options.leaseMilliseconds ?? 60_000,
  };
  const rows = await claimOutbox(pool, claimOptions);
  if (!rows.length) return 0;
  try {
    await handler(rows.map(toEvent));
    for (const row of rows) {
      await pool.query(
        "UPDATE outbox SET status = 'done', processed_at = now(), locked_by = NULL, lease_expires_at = NULL WHERE id = $1 AND status = 'processing' AND locked_by = $2",
        [row.id, claimOptions.consumerId]
      );
    }
  } catch (err) {
    for (const row of rows) {
      const attempts = Number(row.attempts);
      const status = attempts >= claimOptions.maxAttempts ? "dead" : "retry";
      await pool.query(
        "UPDATE outbox SET status = $2, attempts = $3, last_error = $4, locked_by = NULL, lease_expires_at = NULL WHERE id = $1 AND status = 'processing' AND locked_by = $5",
        [row.id, status, attempts, String(err).slice(0, 500), claimOptions.consumerId]
      );
    }
  }
  return rows.length;
}
