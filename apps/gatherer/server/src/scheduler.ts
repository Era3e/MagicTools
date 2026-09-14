import cron from "node-cron";
import { pool } from "./db";
import type { CollectService } from "./collect.service";
import { listSources } from "./source.repo";

const registry = new Map<string, cron.ScheduledTask>();
let refreshChain: Promise<void> = Promise.resolve();

export interface SchedulerTask {
  sourceId: string;
  name: string;
  cron: string;
  registered: boolean;
  lastRunAt: string | null;
  lastRunStatus: "not_run" | "running" | "success" | "dead";
  lastRunFetchedCount: number | null;
  lastRunNewCount: number | null;
  lastRunError: string | null;
}

interface RunReceipt {
  sourceId: string;
  startedAt: string;
  status: "running" | "success" | "dead";
  fetchedCount: number;
  newCount: number;
  error: string | null;
}

export function isValidCron(expr: string): boolean {
  if (!expr) return false;
  try {
    return cron.validate(expr);
  } catch {
    return false;
  }
}

export function buildSchedulerStatus(
  tasks: Array<{ id: string; name: string; cron: string; lastRunAt?: string | null }>,
  registeredIds: Iterable<string> = [],
  runs: Record<string, RunReceipt> = {}
): { tasks: SchedulerTask[] } {
  const registered = new Set(registeredIds);
  return {
    tasks: tasks.map((task) => {
      const run = runs[task.id];
      return {
        sourceId: task.id,
        name: task.name,
        cron: task.cron,
        registered: registered.has(task.id),
        lastRunAt: run?.startedAt ?? task.lastRunAt ?? null,
        lastRunStatus: run?.status ?? "not_run",
        lastRunFetchedCount: run?.fetchedCount ?? null,
        lastRunNewCount: run?.newCount ?? null,
        lastRunError: run?.error ?? null,
      };
    }),
  };
}

export async function startScheduler(collect: CollectService): Promise<void> {
  const sources = await listSources();
  for (const source of sources) {
    if (source.status !== "active" || !source.cron || !isValidCron(source.cron)) continue;
    const task = cron.schedule(source.cron, () => {
      collect.collect(source.id).catch((err) => console.error("[scheduler] " + source.name + " collect failed: " + String(err)));
    });
    registry.set(source.id, task);
  }
  console.log("[scheduler] registered " + registry.size + " tasks");
}

export async function refreshScheduler(collect: CollectService): Promise<void> {
  const operation = refreshChain.then(() => startSchedulerAfterStop(collect));
  refreshChain = operation.catch(() => undefined);
  return operation;
}

async function startSchedulerAfterStop(collect: CollectService): Promise<void> {
  stopScheduler();
  await startScheduler(collect);
}

export function stopScheduler(): void {
  for (const task of registry.values()) task.stop();
  registry.clear();
}

export async function schedulerStatus(): Promise<{ tasks: SchedulerTask[] }> {
  const sources = await listSources();
  const tasks = sources.filter((s) => s.status === "active" && s.cron);
  const runs: Record<string, RunReceipt> = {};
  if (tasks.length) {
    const rows = await pool.query(
      `SELECT DISTINCT ON (source_id) source_id, started_at, status, fetched_count, new_count, error
       FROM runs
       WHERE source_id = ANY($1::uuid[])
       ORDER BY source_id, started_at DESC`,
      [tasks.map((task) => task.id)]
    );
    for (const row of rows.rows) {
      runs[row.source_id as string] = {
        sourceId: row.source_id,
        startedAt: new Date(row.started_at as string).toISOString(),
        status: row.status as RunReceipt["status"],
        fetchedCount: Number(row.fetched_count ?? 0),
        newCount: Number(row.new_count ?? 0),
        error: (row.error as string | null) ?? null,
      };
    }
  }
  return buildSchedulerStatus(tasks, registry.keys(), runs);
}
