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

export interface RequirementLink {
  requirementId: string;
  requirementUrl: string;
  source: string;
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
  spaceKey: "development" | "product";
  status: "draft" | "published" | "archived";
  sourceRevision: string;
  sourceUrl?: string;
  requirementId?: string;
  requirementUrl?: string;
  requirementLinks?: RequirementLink[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchHit extends Entry {
  score: number;
}


export interface PublicEntry extends Entry {
  sourceUrl: string;
  productVersion: string;
  productVersionId: string;
  deploymentRef: string;
  requirementLinks: RequirementLink[];
}

export interface PublicSearchCandidate {
  entryId: string;
  source: string;
  title: string;
  category: string;
  content: string;
  revisionId: string;
  revisionNo: number;
  sourceRevision: string;
  sourceUrl: string;
  productVersion: string;
  deploymentRef: string;
  chunkNo: number;
  charStart: number;
  charEnd: number;
  score: number;
  channels: Array<"fts" | "vector">;
  requirementLinks: RequirementLink[];
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

export interface ConflictInfo {
  entryId: string;
  sourceRef: string;
  title: string;
  dbContent: string;
  obsidianContent: string;
  dbUpdatedAt: string;
}

export const api = {
  listEntries: (filters: { source?: string; category?: string; spaceKey?: "development" | "product" } = {}) => {
    const qs = new URLSearchParams();
    if (filters.source) qs.set("source", filters.source);
    if (filters.category) qs.set("category", filters.category);
    if (filters.spaceKey) qs.set("spaceKey", filters.spaceKey);
    const s = qs.toString();
    return request<Entry[]>("/entries" + (s ? "?" + s : ""));
  },
  createEntry: (input: { title: string; content?: string; category?: string; tags?: string[] }) =>
    request<Entry>("/entries", { method: "POST", body: JSON.stringify(input) }),
  patchEntry: (id: string, patch: { title?: string; content?: string; summary?: string; category?: string; tags?: string[]; assistantScope?: boolean }) =>
    request<Entry>("/entries/" + id, { method: "PATCH", body: JSON.stringify(patch) }),
  scopeCategory: (category: string, scope: boolean) =>
    request<{ updated: number }>("/entries/scope-category", { method: "POST", body: JSON.stringify({ category, scope }) }),
  search: (q: string, mode: "fts" | "vector", limit = 10, spaceKey?: "development" | "product") =>
    request<SearchHit[]>("/entries/search?q=" + encodeURIComponent(q) + "&mode=" + mode + "&limit=" + limit + (spaceKey ? "&spaceKey=" + spaceKey : "")),
  currentPublicVersion: () =>
    request<{ id: string; version: string; sourceRevision: string; deploymentRef: string }>("/public/version/current"),
  listPublicEntries: () => request<PublicEntry[]>("/public/entries"),
  publicSearch: (q: string, limit = 5) =>
    request<{ candidates: PublicSearchCandidate[] }>("/public/search", {
      method: "POST",
      body: JSON.stringify({ q, limit }),
    }),
  pollInbox: () => request<{ consumed: number; created: number; skipped: number }>("/inbox/poll", { method: "POST" }),
  generateGraph: () => request<{ entities: number; relations: number }>("/graph/generate", { method: "POST" }),
  getGraph: () => request<{ nodes: GraphNode[]; edges: GraphEdge[] }>("/graph"),
  getSettings: () => request<{ vaultPath: string }>("/settings"),
  patchSettings: (vaultPath: string) => request<{ vaultPath: string }>("/settings", { method: "PATCH", body: JSON.stringify({ vaultPath }) }),
  syncObsidian: () => request<{ scanned: number; created: number; skipped: number; conflicts: ConflictInfo[] }>("/sync/obsidian", { method: "POST" }),
  listConflicts: () => request<ConflictInfo[]>("/sync/conflicts"),
  resolveConflict: (entryId: string, strategy: "keep-db" | "take-obsidian" | "merge", mergedContent?: string) =>
    request<void>("/sync/conflicts/" + entryId + "/resolve", { method: "POST", body: JSON.stringify({ strategy, mergedContent }) }),
  batchResolve: (resolutions: Array<{ entryId: string; strategy: "keep-db" | "take-obsidian" | "merge"; mergedContent?: string }>) =>
    request<{ resolved: number }>("/sync/conflicts/batch-resolve", { method: "POST", body: JSON.stringify({ resolutions }) }),
  embeddingStatus: () =>
    request<{ stub: boolean; provider: string; model: string; apiKeyConfigured: boolean }>("/meta/embedding-status"),
};
