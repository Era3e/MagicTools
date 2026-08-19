import cron from "node-cron";
import type { CollectService } from "./collect.service";
import { listSources } from "./source.repo";

const registry = new Map<string, cron.ScheduledTask>();

export function isValidCron(expr: string): boolean {
  if (!expr) return false;
  try {
    return cron.validate(expr);
  } catch {
    return false;
  }
}

export function buildSchedulerStatus(tasks: Array<{ id: string; name: string; cron: string }>): { tasks: Array<{ sourceId: string; name: string; cron: string }> } {
  return { tasks: tasks.map((t) => ({ sourceId: t.id, name: t.name, cron: t.cron })) };
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

export function stopScheduler(): void {
  for (const task of registry.values()) task.stop();
  registry.clear();
}

export async function schedulerStatus(): Promise<{ tasks: Array<{ sourceId: string; name: string; cron: string }> }> {
  const sources = await listSources();
  return buildSchedulerStatus(sources.filter((s) => s.status === "active" && s.cron));
}
