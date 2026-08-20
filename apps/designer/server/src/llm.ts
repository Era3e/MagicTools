import { createModelClient, type ChatMessage, type ChatOptions } from "@mt/model-client";
import { ZHIPU } from "@mt/model-client";

const client = createModelClient(ZHIPU, (u) => console.log("[llm]", u.model, u.ms + "ms"));

export const STUB_COMPONENT_NAME = "GreetingCard";
export const STUB_COMPONENT_DESCRIPTION = "示例问候卡片（桩模式）";
export const STUB_COMPONENT_CODE = `import { Card, Tag } from "antd";
import { tokens } from "@mt/ui";

export default function GreetingCard({ title = "你好" }: { title?: string }) {
  return (
    <Card>
      <Tag color="blue">示例组件</Tag>
      <h3>{title}</h3>
      <p>这是桩模式生成的示例组件（基于 @mt/ui 令牌）。</p>
    </Card>
  );
}
`;

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
  if (sysText.includes("{component")) {
    return {
      componentName: STUB_COMPONENT_NAME,
      description: STUB_COMPONENT_DESCRIPTION,
      code: STUB_COMPONENT_CODE,
    };
  }
  return {};
}
