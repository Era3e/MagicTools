import { Injectable } from "@nestjs/common";
import type { ChatMessage } from "@mt/model-client";
import { parseJson } from "./json";
import { llmChat, type Intent } from "./llm";
import { intentSchema } from "./schemas";

const INTENT_PROMPT =
  "你是意图分类助手。把用户消息分类为六类：product_inquiry（产品/知识问答）、data_query（数据/指标/报表查询；以及 cybercloud 平台域操作——插件、业务对象、字段、智能体等，一律交给 cybercloud 智能体处理）、process_execution（要求创建需求、触发采集等 MagicTools 平台流程动作）、trouble_shooting（报错、失败、请求排查故障）、complaint_feedback（投诉、提反馈）、chitchat_reject（问候闲聊等与能力无关）。注意：涉及 cybercloud 域（插件/对象/字段/智能体）的消息即使含有「创建」等动作词也应归为 data_query；只有 MagicTools 内部动作（创建需求/触发采集）才归为 process_execution。只输出 JSON：{intent: \"...\"}。{intent}";

@Injectable()
export class IntentService {
  async classify(message: string, history: Array<{ role: "user" | "assistant"; content: string }> = []): Promise<Intent> {
    const messages: ChatMessage[] = [
      { role: "system", content: INTENT_PROMPT },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];
    const raw = await llmChat(messages);
    try {
      return intentSchema.parse(parseJson(raw)).intent;
    } catch {
      return "product_inquiry";
    }
  }
}
