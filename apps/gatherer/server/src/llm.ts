import { createModelClient, type ChatMessage, type ChatOptions } from "@mt/model-client";
import { ZHIPU } from "@mt/model-client";

const client = createModelClient(ZHIPU, (u) => console.log("[llm]", u.model, u.ms + "ms"));

export async function llmChat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  if (process.env.MT_LLM_STUB === "1") {
    return JSON.stringify({ stub: true, ...JSON.parse(stubPayloadFor(messages)) });
  }
  const result = await client.chat(messages, options);
  return result.content;
}

function stubPayloadFor(messages: ChatMessage[]): string {
  const system = messages.find((m) => m.role === "system");
  const sysText = typeof system?.content === "string" ? system.content : "";
  if (sysText.includes("{summary")) {
    return JSON.stringify({ summary: "示例摘要：该条目讨论行业热点与趋势。", category: "行业资讯", keywords: ["行业", "热点", "趋势"] });
  }
  return "{}";
}
