import { afterEach, describe, expect, it, vi } from "vitest";
import { llmChat, STUB_COMPONENT_CODE, STUB_COMPONENT_NAME } from "./llm";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("llm", () => {
  it("桩模式生成返回固定示例组件", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const out = await llmChat([
      { role: "system", content: "输出 JSON：{componentName, description, code}。{component}" },
      { role: "user", content: "生成一个问候卡片组件" },
    ]);
    const json = JSON.parse(out) as { componentName: string; code: string };
    expect(json.componentName).toBe(STUB_COMPONENT_NAME);
    expect(json.code).toContain("GreetingCard");
    expect(json.code).toContain('from "@mt/ui"');
  });

  it("真实模式调用 chat/completions 并返回内容", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"componentName\":\"X\",\"code\":\"export default () => null\"}" } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await llmChat([{ role: "user", content: "生成组件" }]);
    expect(JSON.parse(out).componentName).toBe("X");
  });

  it("视觉模式使用 visionModel 路由", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    await llmChat(
      [
        { role: "system", content: "你根据设计稿生成组件。{component}" },
        {
          role: "user",
          content: [
            { type: "text", text: "按照这个设计稿生成组件" },
            { type: "image_url", image_url: { url: "https://example.com/design.png" } },
          ],
        },
      ],
      { vision: true }
    );
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("glm-4v-flash");
    expect(body.messages[1].content[1].type).toBe("image_url");
  });
});
