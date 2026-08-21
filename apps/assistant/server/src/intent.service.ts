import { Injectable } from "@nestjs/common";
import type { ChatMessage } from "@mt/model-client";
import { parseJson } from "./json";
import { classifyDomain, classifyIntent, llmChat, type Intent } from "./llm";
import { routingSchema } from "./schemas";

const INTENT_PROMPT =
  "你是多系统意图路由助手。先判断用户消息所属系统（domain）：cybercloud（数据/指标/报表查询，以及插件、业务对象、字段、智能体等平台域操作）｜magictools（MagicTools 平台内部：知识问答、创建需求、触发采集、故障排查、投诉反馈）｜chitchat（问候闲聊）。再在所属系统内判断意图（intent）：product_inquiry（产品/知识问答）、data_query（数据/指标/报表查询，或 cybercloud 域操作）、process_execution（MagicTools 内部动作：创建需求、触发采集）、trouble_shooting（报错、失败、请求排查故障）、complaint_feedback（投诉、提反馈）、chitchat_reject（问候闲聊）。最后给出置信度 confidence（0~1）。注意：涉及 cybercloud 域（插件/对象/字段/智能体/数据查询）的消息即使含「创建」等动作词，domain 也是 cybercloud；只有 MagicTools 内部动作（创建需求/触发采集）domain 才是 magictools。只输出 JSON：{domain: \"...\", intent: \"...\", confidence: 0.95}。{intent}";

export interface RouteResult {
  domain: "magictools" | "cybercloud" | "chitchat";
  intent: Intent;
  confidence: number;
}

@Injectable()
export class IntentService {
  async classify(message: string, history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<RouteResult> {
    const messages: ChatMessage[] = [
      { role: "system", content: INTENT_PROMPT },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];
    const userText = [...history.filter((h) => h.role === "user").map((h) => h.content), message].join("\n");
    const raw = await llmChat(messages);
    try {
      const parsed = routingSchema.parse(parseJson(raw));
      return { domain: parsed.domain, intent: parsed.intent, confidence: parsed.confidence };
    } catch {
      // 规则兜底：确定性路由，置信度记 0 以便观测与纠错
      return { domain: classifyDomain(userText), intent: classifyIntent(userText), confidence: 0 };
    }
  }
}
