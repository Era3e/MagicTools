import { Injectable } from "@nestjs/common";
import type { ChatMessage } from "@mt/model-client";
import { parseJson } from "./json";
import { llmChat, type Intent } from "./llm";
import { intentSchema } from "./schemas";

const INTENT_PROMPT =
  "你是意图分类助手。把用户消息分类为三类：product_inquiry（产品/知识问答）、data_query（数据/指标/报表查询）、chitchat_reject（问候闲聊等与能力无关）。只输出 JSON：{intent: \"...\"}。{intent}";

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
