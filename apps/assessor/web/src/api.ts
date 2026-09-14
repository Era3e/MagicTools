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

export type EvidenceCategory = "routes" | "controller" | "service" | "schema" | "tests";

export interface EvidencePointer {
  commit: string;
  path: string;
  startLine: number;
  endLine: number;
  url: string;
  excerpt: string;
}

export interface EvidenceCandidate {
  id: string;
  taskId: string;
  title: string;
  description: string;
  motivation: "unknown";
  category: EvidenceCategory;
  path: string;
  contentSha256: string;
  evidence: EvidencePointer;
  createdAt: string;
}

export interface EvidenceTask {
  id: string;
  repo: string;
  commitSha: string;
  commitMessage: string;
  totalFiles: number;
  selectedFiles: number;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceTaskListItem extends EvidenceTask {
  candidateCount: number;
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
  reverseEngineer: (input: { repo: string; commitSha: string }) =>
    request<{ created: boolean; task: EvidenceTask; candidates: EvidenceCandidate[] }>("/repository-evidence/reverse-engineer", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listEvidenceTasks: (limit = 50) => request<{ items: EvidenceTaskListItem[] }>(`/repository-evidence/tasks?limit=${limit}`),
  getEvidenceTask: (id: string) =>
    request<{ task: EvidenceTask; candidates: EvidenceCandidate[] }>("/repository-evidence/tasks/" + id),
};
