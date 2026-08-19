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
  // 判别标记放在系统消息里（{analysis / {design），避免用户消息互相包含关键词误判
  if (sysText.includes("{analysis")) {
    return JSON.stringify({ analysis: "# 需求分析（桩）\n\n## 背景\n来自调研结构化数据。\n\n## 核心问题\n- 痛点集中\n\n## 风险\n- 需人工确认" });
  }
  if (sysText.includes("{design")) {
    return JSON.stringify({ design: "# 设计方案（桩）\n\n## 功能拆解\n- 模块一\n\n## 技术方案\n沿用 Monorepo 模式\n\n## 验收标准\n- CI 全绿\n\n## 工作量估算\n约 1 周" });
  }
  return "{}";
}
