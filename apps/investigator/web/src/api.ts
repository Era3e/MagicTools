const BASE = "/api/investigator";

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

export interface Survey {
  id: string;
  name: string;
  description: string;
  status: string;
  source: string;
  appToken: string;
  tableId: string;
  answerFields: string[];
  summary: string | null;
  lastSyncedAt: string | null;
  updatedAt: string;
}

export interface ResponseItem {
  id: string;
  surveyId: string;
  recordId: string;
  rawFields: Record<string, string[]>;
  structured: Record<string, unknown>;
  sentiment: string;
  priority: string;
  summary: string;
  pushedAt: string | null;
}

export const api = {
  listSurveys: () => request<Survey[]>("/surveys"),
  getSurvey: (id: string) => request<Survey>("/surveys/" + id),
  createSurvey: (input: { name: string; description?: string; appToken?: string; tableId?: string; answerFields?: string[] }) =>
    request<Survey>("/surveys", { method: "POST", body: JSON.stringify(input) }),
  syncSurvey: (id: string) => request<{ fetchedCount: number; processedCount: number }>("/surveys/" + id + "/sync", { method: "POST" }),
  listResponses: (id: string, filters?: { sentiment?: string; priority?: string }) => {
    const qs = new URLSearchParams();
    if (filters?.sentiment) qs.set("sentiment", filters.sentiment);
    if (filters?.priority) qs.set("priority", filters.priority);
    const q = qs.toString();
    return request<ResponseItem[]>("/surveys/" + id + "/responses" + (q ? "?" + q : ""));
  },
  summarizeSurvey: (id: string) => request<{ summary: string }>("/surveys/" + id + "/summarize", { method: "POST" }),
  pushResponses: (id: string, recordIds: string[]) =>
    request<{ pushedCount: number; eventIds: string[] }>("/surveys/" + id + "/push", { method: "POST", body: JSON.stringify({ recordIds }) }),
  sendLink: (id: string) => request<{ sent: boolean }>("/surveys/" + id + "/send-link", { method: "POST" }),
  feishuStatus: () => request<{ configured: boolean; stub?: boolean }>("/meta/feishu-status"),
};
