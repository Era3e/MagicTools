const BASE = "/api/assessor";

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

export interface AnalysisRequest {
  id: string;
  surveyName: string;
  sourceEventIds: string[];
  status: "pending" | "draft" | "review" | "approved" | "rejected";
  contextText: string;
  repoUrl: string;
  repoContext: Record<string, unknown> | null;
  analysisMd: string | null;
  designMd: string | null;
  reviewComment: string;
  pushedAt: string | null;
  updatedAt: string;
}

export const api = {
  pollInbox: () => request<{ consumed: number; created: number; skipped: number }>("/inbox/poll", { method: "POST" }),
  listRequests: (status?: string) => request<AnalysisRequest[]>(status ? "/requests?status=" + encodeURIComponent(status) : "/requests"),
  getRequest: (id: string) => request<AnalysisRequest>("/requests/" + id),
  updateContext: (id: string, patch: { contextText?: string; repoUrl?: string }) =>
    request<AnalysisRequest>("/requests/" + id, { method: "PATCH", body: JSON.stringify(patch) }),
  generate: (id: string) => request<AnalysisRequest>("/requests/" + id + "/generate", { method: "POST" }),
  review: (id: string, input: { approve: boolean; comment?: string }) =>
    request<AnalysisRequest>("/requests/" + id + "/review", { method: "POST", body: JSON.stringify(input) }),
  push: (id: string) => request<{ pushed: boolean; eventId: string }>("/requests/" + id + "/push", { method: "POST" }),
  githubStatus: () => request<{ tokenConfigured: boolean; stub?: boolean }>("/meta/github-status"),
};
