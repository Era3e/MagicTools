const BASE = "/api/gatherer";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || "请求失败 " + res.status);
  }
  return res.json() as Promise<T>;
}

export interface Source {
  id: string;
  name: string;
  type: "rss" | "json_api" | "web";
  url: string;
  cron: string;
  options: Record<string, unknown>;
  status: string;
  lastRunAt: string | null;
}

export interface Item {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  content: string;
  publishedAt: string | null;
  fingerprint: string;
  category: string;
  keywords: string[];
  summary: string;
  llmEnriched: boolean;
  pushedAt: string | null;
}

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

export interface DeadLetter {
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

export const api = {
  listSources: () => request<Source[]>("/sources"),
  getSource: (id: string) => request<Source>("/sources/" + id),
  createSource: (input: { name: string; type: string; url?: string; cron?: string; options?: Record<string, unknown> }) =>
    request<Source>("/sources", { method: "POST", body: JSON.stringify(input) }),
  updateSource: (id: string, patch: Record<string, unknown>) =>
    request<Source>("/sources/" + id, { method: "PATCH", body: JSON.stringify(patch) }),
  testSource: (id: string) => request<{ items: Array<{ url: string; title: string }> }>("/sources/" + id + "/test", { method: "POST" }),
  collectSource: (id: string) => request<{ fetched: number; new: number; skipped: number }>("/sources/" + id + "/collect", { method: "POST" }),
  listItems: (sourceId: string) => request<Item[]>("/items?sourceId=" + encodeURIComponent(sourceId)),
  pushItems: (ids: string[]) => request<{ pushedCount: number; eventIds: string[] }>("/items/push", { method: "POST", body: JSON.stringify({ ids }) }),
  schedulerStatus: () => request<{ tasks: SchedulerTask[] }>("/meta/scheduler-status"),
  listDeadLetters: () => request<DeadLetter[]>("/meta/dead-letters"),
};
