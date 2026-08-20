import { createModelClient, type ChatMessage, type ChatOptions } from "@mt/model-client";
import { ZHIPU } from "@mt/model-client";

export const EMBEDDING_DIMS = 1024;

export type Intent = "product_inquiry" | "data_query" | "chitchat_reject";

const client = createModelClient(ZHIPU, (u) => console.log("[llm]", u.model, u.ms + "ms"));

export async function llmChat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  if (process.env.MT_LLM_STUB === "1") {
    return JSON.stringify(stubPayloadFor(messages));
  }
  const result = await client.chat(messages, options);
  return result.content;
}

function stubPayloadFor(messages: ChatMessage[]): Record<string, unknown> {
  const system = messages.find((m) => m.role === "system");
  const sysText = typeof system?.content === "string" ? system.content : "";
  if (sysText.includes("{intent")) {
    const userText = messages
      .filter((m) => m.role === "user")
      .map((m) => (typeof m.content === "string" ? m.content : ""))
      .join("\n");
    return { intent: classifyIntent(userText) };
  }
  if (sysText.includes("{answer")) {
    return { answer: "桩回答：基于圈定知识的回答。" };
  }
  return {};
}

/** 桩模式意图判别：数据关键词优先，其次问候，其余产品问答 */
export function classifyIntent(text: string): Intent {
  if (/(数据|查询|统计|报表|指标)/.test(text)) return "data_query";
  if (/^(你好|您好|hi|hello|谢谢|再见|拜拜)/i.test(text.trim())) return "chitchat_reject";
  return "product_inquiry";
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (process.env.MT_LLM_STUB === "1") {
    return texts.map((t) => pseudoVector(t, EMBEDDING_DIMS));
  }
  return client.embed(texts);
}

/** 桩模式确定性伪向量：字符 bigram 哈希打点后单位化（与 scholar 桩向量算法一致，保证检索相似性） */
export function pseudoVector(text: string, dims = EMBEDDING_DIMS): number[] {
  const vec = new Array<number>(dims).fill(0);
  const t = text.toLowerCase();
  for (let i = 0; i < t.length - 1; i++) {
    const bigram = t.slice(i, i + 2);
    let h = 2166136261;
    for (let j = 0; j < bigram.length; j++) {
      h ^= bigram.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
    vec[(h >>> 0) % dims] = 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}
