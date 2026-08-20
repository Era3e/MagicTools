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

export interface ChatResponse {
  sessionId: string;
  reply: string;
  intent: "product_inquiry" | "data_query" | "chitchat_reject";
  citations: Citation[];
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  intent: string;
  citations: Citation[];
  createdAt: string;
}

export const api = {
  chat: (input: { sessionId?: string; message: string }) =>
    request<ChatResponse>("/chat", { method: "POST", body: JSON.stringify(input) }),
  listConversations: () => request<Conversation[]>("/conversations"),
  getMessages: (id: string) => request<Message[]>("/conversations/" + id + "/messages"),
  deleteConversation: (id: string) => request<{ deleted: boolean }>("/conversations/" + id, { method: "DELETE" }),
};
