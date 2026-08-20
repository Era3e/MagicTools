import { BadGatewayException, Injectable } from "@nestjs/common";
import { parseJson } from "./json";
import { llmChat } from "./llm";
import { answerSchema } from "./schemas";

const PAYLOAD_TTL_MS = 30 * 60 * 1000;

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

/**
 * cybercloud 真实契约适配器（cloud-meta 源码逆向）：
 * 1. apiKey → payload：POST /api/auth/setup/user/access/token/userByApiKey {apiKey} → data.payload（UserDto JSON）
 * 2. 智能体列表：POST /api/setup/agent/chat/agents {from:"Setup"}（header: payload=encodeURIComponent(payload)）
 * 3. 建会话：POST /api/setup/agent/chat/session/create {agentId} → data.code
 * 4. 阻塞对话：POST /api/setup/agent/chat/block {message, sessionCode, temperature} → data{type,data}
 *    type: MARKDOWN（文本）/ METRIC_CHART / REPORT_CHART（图表 JSON）/ ERROR
 */
@Injectable()
export class CybercloudService {
  private payloadCache: { payload: string; at: number } | null = null;
  private sessionCache: { agentId: string; code: string } | null = null;

  status() {
    return {
      configured: Boolean(process.env.CYBERCLOUD_BASE_URL && process.env.CYBERCLOUD_API_KEY),
      stub: process.env.CYBERCLOUD_STUB === "1",
      baseUrl: process.env.CYBERCLOUD_BASE_URL ?? "",
      agentId: process.env.CYBERCLOUD_AGENT_ID ?? "",
    };
  }

  async query(message: string): Promise<{ reply: string }> {
    if (process.env.CYBERCLOUD_STUB === "1") {
      return { reply: "桩数据查询结果：本月销售额 12345 元（CYBERCLOUD_STUB 桩模式）" };
    }
    const baseUrl = process.env.CYBERCLOUD_BASE_URL ?? "";
    const agentId = process.env.CYBERCLOUD_AGENT_ID || (await this.resolveAgentId());
    const sessionCode = await this.resolveSession(agentId);
    const res = await this.post<SseResult>("/api/setup/agent/chat/block", {
      message,
      sessionCode,
      temperature: 0.3,
    });
    return { reply: this.formatSse(res.data) };
  }

  private async ensurePayload(): Promise<string> {
    if (this.payloadCache && Date.now() - this.payloadCache.at < PAYLOAD_TTL_MS) {
      return this.payloadCache.payload;
    }
    // userByApiKey 是匿名接口（apiKey 在 body 中），不走 payload 头认证
    const res = await this.postRaw<{ payload: string }>(
      "/api/auth/setup/user/access/token/userByApiKey",
      { apiKey: process.env.CYBERCLOUD_API_KEY ?? "" },
      { auth: false }
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

  private async postRaw<T>(path: string, body: unknown, opts: { auth: boolean } = { auth: true }): Promise<CyberResponse<T>> {
    const baseUrl = process.env.CYBERCLOUD_BASE_URL ?? "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.auth) {
      headers.payload = encodeURIComponent(await this.ensurePayload());
    }
    const res = await fetch(baseUrl + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
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
