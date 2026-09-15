import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { processOutbox } from "@mt/db";
import type { DataEnvelope } from "@mt/types";
import { pool } from "./db";

export interface ExecutionNotificationView {
  id: string;
  event: string;
  status: "pending" | "processing" | "retry" | "done" | "dead";
  attempts: number;
  lastError: string | null;
  occurredAt: string;
  processedAt: string | null;
  payload: Record<string, unknown>;
}

@Injectable()
export class ExecutionNotificationsService implements OnModuleInit, OnModuleDestroy {
  private dispatchTimer: NodeJS.Timeout | null = null;

  onModuleInit() {
    if (!this.configured()) return;
    this.dispatchTimer = setInterval(() => {
      void this.dispatchOnce().catch((error) => {
        console.error("[execution-notification] dispatch failed: " + String(error?.message ?? error));
      });
    }, 30_000);
    this.dispatchTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.dispatchTimer) clearInterval(this.dispatchTimer);
  }

  async status() {
    const configured = this.configured();
    const countRows = await pool.query(
      `SELECT status,count(*)::int AS count FROM outbox WHERE event='execution.notification' GROUP BY status`
    );
    const counts = Object.fromEntries(countRows.rows.map((row) => [row.status as string, Number(row.count)]));
    const rows = await pool.query(
      `SELECT id,event,status,attempts,last_error,occurred_at,processed_at,payload
       FROM outbox WHERE event='execution.notification' ORDER BY occurred_at DESC LIMIT 100`
    );
    const items = rows.rows.map((row): ExecutionNotificationView => ({
      id: row.id as string,
      event: row.event as string,
      status: row.status as ExecutionNotificationView["status"],
      attempts: Number(row.attempts),
      lastError: (row.last_error as string | null) ?? null,
      occurredAt: new Date(row.occurred_at as Date).toISOString(),
      processedAt: row.processed_at == null ? null : new Date(row.processed_at as Date).toISOString(),
      payload: (row.payload as Record<string, unknown>) ?? {},
    }));
    return { configured, webhookConfigured: configured, counts, items };
  }

  async dispatchOnce(options: { webhookUrl?: string; webhookToken?: string; fetchImpl?: typeof fetch } = {}) {
    const webhookUrl = options.webhookUrl ?? process.env.MANAGER_NOTIFICATION_WEBHOOK_URL ?? "";
    const webhookToken = options.webhookToken ?? process.env.MANAGER_NOTIFICATION_WEBHOOK_TOKEN ?? "";
    if (!/^https:\/\/[^\s]+$/.test(webhookUrl)) return { configured: false, dispatched: 0 };
    const fetchImpl = options.fetchImpl ?? fetch;
    const dispatched = await processOutbox(pool, async (event: DataEnvelope<unknown>) => {
      const response = await fetchImpl(webhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(webhookToken ? { authorization: "Bearer " + webhookToken } : {}),
        },
        body: JSON.stringify({ eventId: event.id, event: event.event, source: event.source, payload: event.payload, occurredAt: event.occurredAt }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("通知接收端 HTTP " + response.status);
    }, { events: ["execution.notification"], consumerId: "manager-execution-notifier", batchSize: 20, maxAttempts: 5 });
    return { configured: true, dispatched };
  }

  private configured() {
    return /^https:\/\/[^\s]+$/.test(process.env.MANAGER_NOTIFICATION_WEBHOOK_URL ?? "");
  }
}
