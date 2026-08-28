import { randomUUID } from "node:crypto";

export interface ClawcvConfig {
  baseUrl?: string;
  apiKey?: string;
  /** 告警回调：当检测到配额/Key/限流问题时触发 */
  onAlert?: (alert: ClawcvAlert) => void;
}

export type ClawcvAlertType =
  | "quota_exhausted"   // 402：配额/余额耗尽
  | "key_expired"      // 401：API Key 过期/无效
  | "rate_limited"     // 429：限流
  | "server_error";    // 5xx：服务端错误

export interface ClawcvAlert {
  type: ClawcvAlertType;
  statusCode: number;
  message: string;
  endpoint: string;
  timestamp: string;
}

export class ClawcvClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly onAlert?: (alert: ClawcvAlert) => void;
  /** 已触发告警的 endpoint 集合（节流：同一告警 5min 内只触发一次） */
  private readonly alertCache = new Map<string, number>();
  private readonly ALERT_THROTTLE_MS = 5 * 60 * 1000;

  constructor(config: ClawcvConfig = {}) {
    this.baseUrl = (config.baseUrl ?? process.env.CLAWCV_BACKEND_URL ?? "https://api.wondercv.com").replace(/\/+$/, "");
    this.apiKey = config.apiKey ?? process.env.CLAWCV_API_KEY ?? "";
    this.onAlert = config.onAlert;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /** 触发告警（节流：同类型同 endpoint 5min 内只发一次） */
  private fireAlert(endpoint: string, type: ClawcvAlertType, statusCode: number, message: string): void {
    const key = type + "::" + endpoint;
    const now = Date.now();
    const last = this.alertCache.get(key) ?? 0;
    if (now - last < this.ALERT_THROTTLE_MS) return;
    this.alertCache.set(key, now);
    const alert: ClawcvAlert = {
      type,
      statusCode,
      message,
      endpoint,
      timestamp: new Date().toISOString(),
    };
    // 默认行为：console.warn；生产注入 onAlert 可写 outbox
    console.warn("[clawcv] 告警: " + JSON.stringify(alert));
    try {
      this.onAlert?.(alert);
    } catch {
      // 告警回调失败不影响主流程
    }
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

    // 429 限流：触发告警 + 指数退避重试
    if (response.status === 429) {
      this.fireAlert(path, "rate_limited", 429, "请求限流");
      if (attempts > 1) {
        const delay = 1000 * (4 - attempts);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.request<T>(path, init, attempts - 1);
      }
      throw new Error("ClawCV 限流，重试耗尽");
    }

    // 5xx 服务端错误：重试
    if (response.status >= 500 && attempts > 1) {
      const delay = 1000 * (4 - attempts);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.request<T>(path, init, attempts - 1);
    }

    // 401 Key 过期：立即告警，不重试
    if (response.status === 401) {
      this.fireAlert(path, "key_expired", 401, "API Key 无效或过期");
      throw new Error("ClawCV API Key 无效（401），请检查 CLAWCV_API_KEY");
    }

    // 402 配额耗尽：立即告警，不重试
    if (response.status === 402) {
      this.fireAlert(path, "quota_exhausted", 402, "配额或余额不足");
      throw new Error("ClawCV 配额耗尽（402），请充值或升级套餐");
    }

    const body = (await response.json().catch(() => ({}))) as { code?: number; message?: string; data?: T };
    if (!response.ok) {
      // 其他 4xx 错误
      if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 402) {
        this.fireAlert(path, "server_error", response.status, body.message || "HTTP " + response.status);
      }
      throw new Error(body.message || "HTTP " + response.status);
    }
    if (typeof body.code === "number" && body.code >= 2000) {
      // 业务错误 code>=2000（如额度不足）：也触发告警
      if (body.code >= 2100) {
        this.fireAlert(path, "quota_exhausted", response.status, body.message || "业务错误");
      }
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
