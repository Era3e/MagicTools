const BASE = "/api/assistant";

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

export interface Citation {
  id: string;
  title: string;
  source: string;
  score: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClarifyOption {
  label: string;
  intent: string;
}

export interface VerifyInfo {
  taskId?: string;
  status: "pending" | "consistent" | "divergent" | "unverifiable" | "agent_failed" | "agent_timeout" | "not_applicable";
}

export interface VerifyResult {
  status: VerifyInfo["status"];
  verdict?: { directValue: number; agentNumbers: number[]; diffPct?: number };
  agentReply?: string;
  expired?: boolean;
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  intent: "product_inquiry" | "data_query" | "chitchat_reject" | "process_execution" | "trouble_shooting" | "complaint_feedback";
  domain?: "magictools" | "cybercloud" | "chitchat";
  confidence?: number;
  clarifying?: boolean;
  clarifyOptions?: ClarifyOption[];
  citations: Citation[];
  actionResult?: Record<string, unknown>;
  verify?: VerifyInfo;
  dataSource?: Record<string, unknown>;
}

export interface IntentLog {
  id: string;
  message: string;
  domain: string;
  intent: string;
  confidence: number;
  correctedIntent: string | null;
  createdAt: string;
}

export interface CybercloudCall {
  id: string;
  route: string;
  endpoint: string;
  ok: boolean;
  latencyMs: number;
  error: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface Feedback {
  id: string;
  content: string;
  contact: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  intent: string;
  citations: Citation[];
  actionResult?: Record<string, unknown>;
  clarifying?: boolean;
  clarifyOptions?: ClarifyOption[];
  verify?: VerifyInfo;
  createdAt: string;
}

export const api = {
  chat: (input: { sessionId?: string; message: string }) =>
    request<ChatResponse>("/chat", { method: "POST", body: JSON.stringify(input) }),
  getVerify: (taskId: string): Promise<VerifyResult> =>
    fetch(BASE + "/chat/verify/" + taskId, { headers: { "Content-Type": "application/json" } }).then(async (res) => {
      if (res.status === 404) {
        return { status: "agent_timeout", expired: true };
      }
      if (!res.ok) {
        throw new Error("请求失败 " + res.status);
      }
      return res.json() as Promise<VerifyResult>;
    }),
  listConversations: () => request<Conversation[]>("/conversations"),
  getMessages: (id: string) => request<Message[]>("/conversations/" + id + "/messages"),
  deleteConversation: (id: string) => request<{ deleted: boolean }>("/conversations/" + id, { method: "DELETE" }),
  listFeedback: () => request<Feedback[]>("/feedback"),
  deleteFeedback: (id: string) => request<{ deleted: boolean }>("/feedback/" + id, { method: "DELETE" }),
  listIntentLogs: (filters: { domain?: string; intent?: string } = {}) => {
    const qs = new URLSearchParams();
    if (filters.domain) qs.set("domain", filters.domain);
    if (filters.intent) qs.set("intent", filters.intent);
    const s = qs.toString();
    return request<IntentLog[]>("/intent-logs" + (s ? "?" + s : ""));
  },
  correctIntentLog: (id: string, correctedIntent: string) =>
    request<IntentLog>("/intent-logs/" + id + "/correct", { method: "POST", body: JSON.stringify({ correctedIntent }) }),
  intentEvaluation: () =>
    request<{
      confusion: { matrix: Record<string, Record<string, number>>; labels: string[]; total: number; diagHits: number };
      stats: Array<{ intent: string; total: number; corrected: number }>;
    }>("/intent-logs/evaluation"),
  intentReplay: () =>
    request<{ total: number; hits: number; accuracy: number; misses: Array<{ message: string; predicted: string; actual: string }> }>(
      "/intent-logs/evaluation/replay"
    ),
  datasetPreview: () =>
    request<{ count: number; preview: Array<{ messages: Array<{ role: string; content: string }> }> }>("/intent-logs/export/preview", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  exportDataset: () => request<{ jsonl: string; count: number }>("/intent-logs/export"),
  listCybercloudCalls: () => request<CybercloudCall[]>("/meta/cybercloud-calls"),
};
