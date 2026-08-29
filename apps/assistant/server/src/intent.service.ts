import { Injectable } from "@nestjs/common";
import type { ChatMessage } from "@mt/model-client";
import { parseJson } from "./json";
import { listCorrectedLogs } from "./intent-log.repo";
import { classifyDomain, classifyIntent, llmChat, type Intent } from "./llm";
import { routingSchema } from "./schemas";

const INTENT_PROMPT =
  "你是多系统意图路由助手。先判断用户消息所属系统（domain）：cybercloud（数据/指标/报表查询，以及插件、业务对象、字段、智能体等平台域操作）｜magictools（MagicTools 平台内部：知识问答、创建需求、触发采集、故障排查、投诉反馈）｜chitchat（问候闲聊）。再在所属系统内判断意图（intent）：product_inquiry（产品/知识问答）、data_query（数据/指标/报表查询，或 cybercloud 域操作）、process_execution（MagicTools 内部动作：创建需求、触发采集）、trouble_shooting（报错、失败、请求排查故障）、complaint_feedback（投诉、提反馈）、chitchat_reject（问候闲聊）。最后给出置信度 confidence（0~1）。注意：涉及 cybercloud 域（插件/对象/字段/智能体/数据查询）的消息即使含「创建」等动作词，domain 也是 cybercloud；只有 MagicTools 内部动作（创建需求/触发采集）domain 才是 magictools。只输出 JSON：{domain: \"...\", intent: \"...\", confidence: 0.95}。{intent}";

/** D-09: few-shot 每意图保留条数（纠错样本均衡采样） */
const FEWSHOT_PER_INTENT = 3;
/** D-09: 纠错样本缓存 TTL（毫秒），避免每次分类查库 */
const FEWSHOT_CACHE_TTL_MS = 60_000;
/** D-09: few-shot 注入的样本总数上限（控制 token） */
const FEWSHOT_MAX_TOTAL = 12;

export interface RouteResult {
  domain: "magictools" | "cybercloud" | "chitchat";
  intent: Intent;
  confidence: number;
  /** D-09: 本次分类注入的 few-shot 示例条数（观测用） */
  fewshotCount?: number;
}

interface FewshotSample {
  message: string;
  domain: string;
  intent: string;
}

interface FewshotCache {
  samples: FewshotSample[];
  loadedAt: number;
}

/** D-09: 从纠错样本均衡构造 few-shot 示例（每意图至多 N 条、总数封顶） */
export function buildFewshotSamples(
  logs: Array<{ message: string; domain: string; correctedIntent: string | null }>,
  perIntent = FEWSHOT_PER_INTENT,
  maxTotal = FEWSHOT_MAX_TOTAL
): FewshotSample[] {
  const byIntent = new Map<string, FewshotSample[]>();
  for (const log of logs) {
    const label = log.correctedIntent;
    if (!label) continue;
    const bucket = byIntent.get(label) ?? [];
    if (bucket.length < perIntent) bucket.push({ message: log.message, domain: log.domain, intent: label });
    byIntent.set(label, bucket);
  }
  const all: FewshotSample[] = [];
  for (const bucket of byIntent.values()) all.push(...bucket);
  return all.slice(0, maxTotal);
}

/** D-09: 将 few-shot 示例渲染进 system 提示词（追加示例段） */
export function renderFewshotPrompt(basePrompt: string, samples: FewshotSample[]): string {
  if (samples.length === 0) return basePrompt;
  const lines = samples.map((s) => `- 「${s.message}」→ {domain: "${s.domain}", intent: "${s.intent}"}\n`);
  return basePrompt + "\n以下是管理员纠错确认过的真实路由示例，优先按这些示例的口径判断：\n" + lines.join("") + "参考完毕，继续只输出 JSON。";
}

@Injectable()
export class IntentService {
  private fewshotCache: FewshotCache | null = null;

  /** D-09: 加载纠错样本并均衡采样（带 TTL 缓存） */
  private async loadFewshot(): Promise<FewshotSample[]> {
    const now = Date.now();
    if (this.fewshotCache && now - this.fewshotCache.loadedAt < FEWSHOT_CACHE_TTL_MS) {
      return this.fewshotCache.samples;
    }
    try {
      const logs = await listCorrectedLogs(200);
      const samples = buildFewshotSamples(logs);
      this.fewshotCache = { samples, loadedAt: now };
      return samples;
    } catch {
      // 库不可用时退化为无 few-shot，不阻塞分类主链路
      this.fewshotCache = { samples: [], loadedAt: now };
      return [];
    }
  }

  /** D-09: 清除 few-shot 缓存（纠错落库后可立即生效） */
  clearFewshotCache(): void {
    this.fewshotCache = null;
  }

  async classify(message: string, history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<RouteResult> {
    const samples = await this.loadFewshot();
    const systemPrompt = renderFewshotPrompt(INTENT_PROMPT, samples);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];
    const userText = [...history.filter((h) => h.role === "user").map((h) => h.content), message].join("\n");
    const raw = await llmChat(messages);
    try {
      const parsed = routingSchema.parse(parseJson(raw));
      return { domain: parsed.domain, intent: parsed.intent, confidence: parsed.confidence, fewshotCount: samples.length };
    } catch {
      // 规则兜底：确定性路由，置信度记 0 以便观测与纠错
      return { domain: classifyDomain(userText), intent: classifyIntent(userText), confidence: 0, fewshotCount: samples.length };
    }
  }
}
