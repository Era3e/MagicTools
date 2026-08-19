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
  // 顺序敏感：结构化提示中包含 summary 字段名，先判结构化再判总结
  if (sysText.includes("结构化")) {
    return JSON.stringify({
      requirements: ["批量操作能力", "报表性能优化"],
      painPoints: ["导出慢"],
      expectations: ["更快更省事"],
      sentiment: "negative",
      priority: "P1",
      summary: "受访者希望提升效率",
    });
  }
  if (sysText.includes("summary")) {
    return JSON.stringify({ summary: "示例总结：受访者普遍反馈效率工具不足，期望批量操作与模板能力。" });
  }
  return "{}";
}
