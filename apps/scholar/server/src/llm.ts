import { createModelClient, type ChatMessage, type ChatOptions } from "@mt/model-client";
import { ZHIPU } from "@mt/model-client";

export const EMBEDDING_DIMS = 1024;

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
  if (sysText.includes("{graph")) {
    return {
      entities: [
        { name: "知识库", type: "概念" },
        { name: "检索", type: "概念" },
        { name: "图谱", type: "概念" },
      ],
      relations: [
        { from: "知识库", to: "检索", label: "支持" },
        { from: "知识库", to: "图谱", label: "生成" },
      ],
    };
  }
  return {};
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (process.env.MT_LLM_STUB === "1") {
    return texts.map((t) => pseudoVector(t, EMBEDDING_DIMS));
  }
  return client.embed(texts);
}

/** 桩模式确定性伪向量：字符 bigram 哈希打点后单位化（1024 维），共享 bigram 的文本在桩模式下仍具检索相似性 */
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
