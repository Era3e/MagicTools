const BASE = "/api/manager";

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

export type RequirementStatus = "waiting" | "designing" | "todo" | "developing" | "testing" | "accepting" | "done";

export interface Requirement {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceRef: string;
  sourcePayload: Record<string, unknown> | null;
  status: RequirementStatus;
  priority: string;
  iterationId: string | null;
  branch: string;
  prUrl: string;
  labels: string[];
  timeline: Array<{ at: string; from: string; to: string; note?: string }>;
  updatedAt: string;
}

export interface Iteration {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
}

export const api = {
  pollInbox: () => request<{ consumed: number; created: number; skipped: number }>("/inbox/poll", { method: "POST" }),
  listRequirements: (filters?: { status?: string; source?: string; iterationId?: string }) => {
    const qs = new URLSearchParams();
    if (filters?.status) qs.set("status", filters.status);
    if (filters?.source) qs.set("source", filters.source);
    if (filters?.iterationId) qs.set("iterationId", filters.iterationId);
    const q = qs.toString();
    return request<Requirement[]>("/requirements" + (q ? "?" + q : ""));
  },
  getRequirement: (id: string) => request<Requirement>("/requirements/" + id),
  createRequirement: (input: { title: string; description?: string; priority?: string }) =>
    request<Requirement>("/requirements", { method: "POST", body: JSON.stringify(input) }),
  patchRequirement: (id: string, patch: Record<string, unknown>) =>
    request<Requirement>("/requirements/" + id, { method: "PATCH", body: JSON.stringify(patch) }),
  refreshPr: (id: string) => request<Requirement>("/requirements/" + id + "/refresh-pr", { method: "POST" }),
  syncGithub: (repo: string) => request<{ created: number; skipped: number }>("/sync/github", { method: "POST", body: JSON.stringify({ repo }) }),
  listIterations: () => request<Iteration[]>("/iterations"),
  createIteration: (input: { name: string; startDate?: string | null; endDate?: string | null }) =>
    request<Iteration>("/iterations", { method: "POST", body: JSON.stringify(input) }),
};
