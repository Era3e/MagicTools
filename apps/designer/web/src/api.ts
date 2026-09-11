import { extractApiErrorMessage } from "./api-errors";

const BASE = "/api/designer";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(extractApiErrorMessage(body, res.status));
  }
  return res.json() as Promise<T>;
}

export interface GenerateResult {
  generationId: string;
  componentName: string;
  description: string;
  code: string;
  status: "ok" | "failed";
  error?: string;
}

export interface Generation {
  id: string;
  prompt: string;
  imageUrl: string;
  componentName: string;
  description: string;
  code: string;
  status: "ok" | "failed";
  error: string | null;
  createdAt: string;
}

export interface CanvasDocPayload {
  componentName: string;
  description?: string;
  root: unknown;
}

export interface ComponentItem {
  id: string;
  name: string;
  description: string;
  code: string;
  schema?: CanvasDocPayload | null;
  createdAt: string;
  status?: string;
}

export const api = {
  generate: (input: { prompt: string; imageUrl?: string }) =>
    request<GenerateResult>("/generate", { method: "POST", body: JSON.stringify(input) }),
  preview: (code: string) => request<{ ok: boolean; previewId?: string; error?: string }>("/preview", { method: "POST", body: JSON.stringify({ code }) }),
  previewUrl: (id: string) => BASE + "/preview/" + id,
  listGenerations: () => request<Generation[]>("/generations"),
  listComponents: () => request<ComponentItem[]>("/components"),
  addComponent: (input: { name: string; description: string; code: string; schema?: CanvasDocPayload }) =>
    request<{ component: ComponentItem; duplicated: boolean }>("/components", { method: "POST", body: JSON.stringify(input) }),
  parseCode: (code: string) =>
    request<{ doc: CanvasDocPayload }>("/parse", { method: "POST", body: JSON.stringify({ code }) }),
  deleteComponent: (id: string) => request<{ deleted: boolean }>("/components/" + id, { method: "DELETE" }),
  publishComponent: (id: string) =>
    request<{ ok: boolean; prUrl: string; prNumber: number; branch: string; targetPath: string; message: string }>(
      "/components/" + id + "/publish",
      { method: "POST" },
    ),
};

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
