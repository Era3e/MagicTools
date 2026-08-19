import { createModelClient, type ChatMessage, type ChatOptions } from "@mt/model-client";
import { ZHIPU } from "@mt/model-client";

const client = createModelClient(ZHIPU, (u) => console.log("[llm]", u.model, u.ms + "ms"));

export async function llmChat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  if (process.env.MT_LLM_STUB === "1") {
    return JSON.stringify({ stub: true, note: "MT_LLM_STUB 模式：CI/E2E 用桩响应", ...JSON.parse(stubPayloadFor(messages)) });
  }
  const result = await client.chat(messages, options);
  return result.content;
}

function stubPayloadFor(messages: ChatMessage[]): string {
  const system = messages.find((m) => m.role === "system");
  const sysText = typeof system?.content === "string" ? system.content : "";
  const last = messages[messages.length - 1];
  const text = typeof last?.content === "string" ? last.content : "";
  if (sysText.includes("match_score")) {
    return JSON.stringify({
      match_score: 66,
      strengths: ["匹配点一"],
      gaps: [{ area: "经验", description: "差距一" }],
      missing_keywords: ["关键词一"],
      recommended_changes: [{ type: "tailoring", description: "建议一" }],
    });
  }
  if (sysText.includes("score")) {
    return JSON.stringify({ score: 88, strengths: ["优势一"], weaknesses: ["短板一"], suggestions: ["建议一"] });
  }
  if (text.includes("JD") || sysText.includes("岗位")) {
    return JSON.stringify({
      company: "示例公司",
      title: "示例岗位",
      requirements: ["要求一"],
      duties: ["职责一"],
      keywords: ["关键词一"],
      salary: "",
      city: "",
    });
  }
  if (text.includes("面试") || sysText.includes("面试")) {
    return JSON.stringify({
      questions: [{ category: "技术", question: "示例问题", comment: "示例点评" }],
      quality: "示例点评",
      suggestions: ["建议一"],
      actionItems: ["行动项一"],
    });
  }
  return "{}";
}
