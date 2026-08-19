const BASE = "/api/scholar";

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

export interface Entry {
  id: string;
  source: "gatherer" | "manual" | "obsidian";
  sourceRef: string | null;
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  assistantScope: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SearchHit extends Entry {
  score: number;
}

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  entryCount: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export const api = {
  listEntries: (filters: { source?: string; category?: string } = {}) => {
    const qs = new URLSearchParams();
    if (filters.source) qs.set("source", filters.source);
    if (filters.category) qs.set("category", filters.category);
    const s = qs.toString();
    return request<Entry[]>("/entries" + (s ? "?" + s : ""));
  },
  createEntry: (input: { title: string; content?: string; category?: string; tags?: string[] }) =>
    request<Entry>("/entries", { method: "POST", body: JSON.stringify(input) }),
  patchEntry: (id: string, patch: { assistantScope?: boolean; category?: string; tags?: string[] }) =>
    request<Entry>("/entries/" + id, { method: "PATCH", body: JSON.stringify(patch) }),
  scopeCategory: (category: string, scope: boolean) =>
    request<{ updated: number }>("/entries/scope-category", { method: "POST", body: JSON.stringify({ category, scope }) }),
  search: (q: string, mode: "fts" | "vector", limit = 10) =>
    request<SearchHit[]>("/entries/search?q=" + encodeURIComponent(q) + "&mode=" + mode + "&limit=" + limit),
  pollInbox: () => request<{ consumed: number; created: number; skipped: number }>("/inbox/poll", { method: "POST" }),
  generateGraph: () => request<{ entities: number; relations: number }>("/graph/generate", { method: "POST" }),
  getGraph: () => request<{ nodes: GraphNode[]; edges: GraphEdge[] }>("/graph"),
  getSettings: () => request<{ vaultPath: string }>("/settings"),
  patchSettings: (vaultPath: string) => request<{ vaultPath: string }>("/settings", { method: "PATCH", body: JSON.stringify({ vaultPath }) }),
  syncObsidian: () => request<{ scanned: number; created: number; skipped: number }>("/sync/obsidian", { method: "POST" }),
  embeddingStatus: () =>
    request<{ stub: boolean; provider: string; model: string; apiKeyConfigured: boolean }>("/meta/embedding-status"),
};
