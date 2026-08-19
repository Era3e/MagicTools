import { randomUUID } from "node:crypto";

export interface ClawcvConfig {
  baseUrl?: string;
  apiKey?: string;
}

export class ClawcvClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ClawcvConfig = {}) {
    this.baseUrl = (config.baseUrl ?? process.env.CLAWCV_BACKEND_URL ?? "https://api.wondercv.com").replace(/\/+$/, "");
    this.apiKey = config.apiKey ?? process.env.CLAWCV_API_KEY ?? "";
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async request<T>(path: string, init: RequestInit = {}, attempts = 3): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: "Bearer " + this.apiKey } : {}),
        "X-API-Version": "v1",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(30000),
    });
    if ((response.status === 429 || response.status >= 500) && attempts > 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (4 - attempts)));
      return this.request<T>(path, init, attempts - 1);
    }
    const body = (await response.json().catch(() => ({}))) as { code?: number; message?: string; data?: T };
    if (!response.ok) {
      throw new Error(body.message || "HTTP " + response.status);
    }
    if (typeof body.code === "number" && body.code >= 2000) {
      throw new Error(body.message || "业务错误 " + body.code);
    }
    return (body.data ?? body) as T;
  }

  async createSession(): Promise<string> {
    const id = randomUUID();
    await this.request("/cv/v1/mcp/session/create", { method: "POST", body: JSON.stringify({ session_id: id }) });
    return id;
  }

  getQuota(): Promise<unknown> {
    return this.request("/cv/v1/skill/auth/quota");
  }

  analyze(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("/cv/v1/mcp/analyze", { method: "POST", body: JSON.stringify(payload) });
  }

  rewrite(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("/cv/v1/mcp/rewrite", { method: "POST", body: JSON.stringify(payload) });
  }

  match(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request("/cv/v1/mcp/match", { method: "POST", body: JSON.stringify(payload) });
  }
}
