import { constants, publicEncrypt } from "node:crypto";
import { BadGatewayException, Injectable } from "@nestjs/common";
import { parseJson } from "./json";
import { llmChat } from "./llm";
import { answerSchema } from "./schemas";

const PAYLOAD_TTL_MS = 30 * 60 * 1000;
const JWT_TTL_MS = 100 * 60 * 1000;

interface CyberResponse<T> {
  code: string;
  message?: string;
  data?: T;
}

interface AgentItem {
  id: string;
  name?: string;
  status?: string;
  enabled?: boolean;
}

interface SseResult {
  type?: string;
  data?: unknown;
  toolCalls?: unknown[];
}

/** 服务端返回 DER base64 公钥（非 PEM），Node 加密前包一层 PKCS#1 PEM 头 */
function toPemPublicKey(key: string): string {
  if (key.includes("BEGIN")) return key;
  const body = (key.replace(/\s/g, "").match(/.{1,64}/g) ?? [key]).join("\n");
  return "-----BEGIN RSA PUBLIC KEY-----\n" + body + "\n-----END RSA PUBLIC KEY-----";
}

/**
 * cybercloud 真实契约适配器（cloud-meta 源码逆向）：
 * 网关层：所有 /api/** 请求需带 jwt 头（APISIX jwt-auth，前端证据 headers.jwt）
 *   JWT 获取：POST /api/auth/login/key → {rsaPublicKey, loginKey}（loginKey 32 位，1 小时有效）
 *            → RSA PKCS1 加密 loginKey+password → POST /api/auth/login {account, password, loginUrl} → data.accessToken
 * 应用层：payload 头（URL 编码 UserDto JSON）：
 *   POST /api/auth/setup/user/access/token/userByApiKey {apiKey} → data.payload
 * 对话：POST /api/setup/agent/chat/agents {from:"Setup"} → 选智能体
 *   → POST /api/setup/agent/chat/session/create {agentId} → data.code
 *   → POST /api/setup/agent/chat/block {message, sessionCode, temperature} → data{type,data}
 */
@Injectable()
export class CybercloudService {
  private payloadCache: { payload: string; at: number } | null = null;
  private sessionCache: { agentId: string; code: string } | null = null;
  private jwtCache: { jwt: string; at: number } | null = null;

  status() {
    return {
      configured: Boolean(process.env.CYBERCLOUD_BASE_URL && process.env.CYBERCLOUD_API_KEY),
      credentialConfigured: Boolean(
        process.env.CYBERCLOUD_JWT || (process.env.CYBERCLOUD_USERNAME && process.env.CYBERCLOUD_PASSWORD)
      ),
      stub: process.env.CYBERCLOUD_STUB === "1",
      baseUrl: process.env.CYBERCLOUD_BASE_URL ?? "",
      agentId: process.env.CYBERCLOUD_AGENT_ID ?? "",
    };
  }

  private base(): string {
    return (process.env.CYBERCLOUD_BASE_URL ?? "").replace(/\/+$/, "");
  }

  async query(message: string): Promise<{ reply: string }> {
    if (process.env.CYBERCLOUD_STUB === "1") {
      return { reply: "桩数据查询结果：本月销售额 12345 元（CYBERCLOUD_STUB 桩模式）" };
    }
    const agentId = process.env.CYBERCLOUD_AGENT_ID || (await this.resolveAgentId());
    const sessionCode = await this.resolveSession(agentId);
    const res = await this.post<SseResult>("/api/setup/agent/chat/block", {
      message,
      sessionCode,
      temperature: 0.3,
    });
    return { reply: this.formatSse(res.data) };
  }

  private async ensureJwt(): Promise<string> {
    if (this.jwtCache && Date.now() - this.jwtCache.at < JWT_TTL_MS) {
      return this.jwtCache.jwt;
    }
    const jwt = await this.login();
    this.jwtCache = { jwt, at: Date.now() };
    return jwt;
  }

  private async login(): Promise<string> {
    const username = process.env.CYBERCLOUD_USERNAME ?? "";
    const password = process.env.CYBERCLOUD_PASSWORD ?? "";
    const preset = process.env.CYBERCLOUD_JWT ?? "";
    if (preset) return preset;
    if (!username || !password) {
      throw new BadGatewayException("cybercloud 登录凭据未配置（CYBERCLOUD_USERNAME/PASSWORD 或 CYBERCLOUD_JWT）");
    }
    const keyRes = await this.postRaw<{ rsaPublicKey?: string; loginKey?: string }>(
      "/api/auth/login/key",
      {},
      { jwt: false, payload: false }
    );
    const { rsaPublicKey, loginKey } = keyRes.data ?? {};
    if (!rsaPublicKey || !loginKey) {
      throw new BadGatewayException("cybercloud 登录公钥获取失败: " + (keyRes.message ?? keyRes.code));
    }
    const encrypted = publicEncrypt(
      { key: toPemPublicKey(rsaPublicKey), padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(loginKey + password, "utf8")
    ).toString("base64");
    const loginRes = await this.postRaw<{ accessToken?: string }>(
      "/api/auth/login",
      { account: username, password: encrypted, loginUrl: this.base() },
      { jwt: false, payload: false }
    );
    const token = loginRes.data?.accessToken;
    if (!token) throw new BadGatewayException("cybercloud 登录失败: " + (loginRes.message ?? loginRes.code));
    return token;
  }

  private async ensurePayload(): Promise<string> {
    if (this.payloadCache && Date.now() - this.payloadCache.at < PAYLOAD_TTL_MS) {
      return this.payloadCache.payload;
    }
    // userByApiKey 匿名接口（apiKey 在 body），但仍需过网关 → 带 jwt 头、不带 payload 头
    const res = await this.postRaw<{ payload: string }>(
      "/api/auth/setup/user/access/token/userByApiKey",
      { apiKey: process.env.CYBERCLOUD_API_KEY ?? "" },
      { jwt: true, payload: false }
    );
    const payload = res.data?.payload;
    if (!payload) throw new BadGatewayException("cybercloud apiKey 换取 payload 失败: " + (res.message ?? res.code));
    this.payloadCache = { payload, at: Date.now() };
    return payload;
  }

  private async resolveAgentId(): Promise<string> {
    const list = await this.post<AgentItem[]>("/api/setup/agent/chat/agents", { from: "Setup" });
    const agent = (list.data ?? []).find((a) => a.enabled !== false && a.status !== "DRAFT") ?? list.data?.[0];
    if (!agent?.id) throw new BadGatewayException("cybercloud 无可用智能体，请先发布一个智能体或配置 CYBERCLOUD_AGENT_ID");
    return agent.id;
  }

  private async resolveSession(agentId: string): Promise<string> {
    if (this.sessionCache && this.sessionCache.agentId === agentId) {
      return this.sessionCache.code;
    }
    const res = await this.post<{ code: string }>("/api/setup/agent/chat/session/create", { agentId });
    if (!res.data?.code) throw new BadGatewayException("cybercloud 会话创建失败");
    this.sessionCache = { agentId, code: res.data.code };
    return res.data.code;
  }

  private async post<T>(path: string, body: unknown): Promise<CyberResponse<T>> {
    return this.postRaw<T>(path, body);
  }

  private async postRaw<T>(
    path: string,
    body: unknown,
    opts: { jwt?: boolean; payload?: boolean } = { jwt: true, payload: true }
  ): Promise<CyberResponse<T>> {
    return this.postRawAttempt<T>(path, body, opts, false);
  }

  private async postRawAttempt<T>(
    path: string,
    body: unknown,
    opts: { jwt?: boolean; payload?: boolean },
    isRetry: boolean
  ): Promise<CyberResponse<T>> {
    const baseUrl = this.base();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.jwt !== false) headers.jwt = await this.ensureJwt();
    if (opts.payload !== false) headers.payload = encodeURIComponent(await this.ensurePayload());
    const res = await fetch(baseUrl + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (res.status === 401 && opts.jwt !== false && !isRetry) {
      this.jwtCache = null;
      return this.postRawAttempt(path, body, opts, true);
    }
    if (!res.ok) throw new BadGatewayException("cybercloud 请求失败: " + res.status);
    const json = (await res.json()) as CyberResponse<T>;
    if (json.code !== "0" && json.code !== undefined) {
      throw new BadGatewayException("cybercloud 业务错误: " + (json.message ?? json.code));
    }
    return json;
  }

  private formatSse(sse: SseResult | undefined): string {
    if (!sse) return "cybercloud 无返回内容";
    if (sse.type === "ERROR") return "查询失败：" + String(sse.data ?? "未知错误");
    if (sse.type === "METRIC_CHART" || sse.type === "REPORT_CHART") {
      return "[" + sse.type + "] " + JSON.stringify(sse.data);
    }
    return String(sse.data ?? "");
  }

  /** LLM 格式化接口（保留供后续增强，当前 block 对话已由 cybercloud 智能体生成回答） */
  async formatAnswer(raw: string): Promise<string> {
    const formatted = await llmChat([
      { role: "system", content: "把数据查询结果整理为自然语言回答。只输出 JSON：{answer: 文本}。{format}" },
      { role: "user", content: raw },
    ]);
    try {
      return answerSchema.parse(parseJson(formatted)).answer;
    } catch {
      return raw;
    }
  }
}
