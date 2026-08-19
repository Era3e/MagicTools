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

/** 桩模式确定性伪向量：文本 hash 作为 LCG 种子展开到指定维度（取值 [-1, 1)） */
export function pseudoVector(text: string, dims = EMBEDDING_DIMS): number[] {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const vec = new Array<number>(dims);
  let state = h >>> 0;
  for (let i = 0; i < dims; i++) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    vec[i] = (state / 4294967296) * 2 - 1;
  }
  return vec;
}
