import { describe, it, expect, vi, afterEach } from "vitest";
import { createModelClient, chatStream } from "./client";
import { DEEPSEEK, ZHIPU } from "./providers";

const okResponse = {
  choices: [{ message: { content: "你好" } }],
  usage: { prompt_tokens: 10, completion_tokens: 2 },
};

afterEach(() => vi.unstubAllGlobals());

describe("model-client", () => {
  it("chat 使用 OpenAI 兼容协议调用并返回内容", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(okResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createModelClient(DEEPSEEK, () => {});
    const result = await client.chat([{ role: "user", content: "hi" }]);
    expect(result.content).toBe("你好");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("deepseek-chat");
    expect(body.messages[0].content).toBe("hi");
  });

  it("chat 遇到 429 自动重试后成功", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createModelClient(DEEPSEEK, () => {});
    const result = await client.chat([{ role: "user", content: "hi" }]);
    expect(result.content).toBe("你好");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("chat 调用结束后上报用量日志", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(okResponse), { status: 200 })));
    const logs: unknown[] = [];
    const client = createModelClient(DEEPSEEK, (u) => logs.push(u));
    await client.chat([{ role: "user", content: "hi" }]);
    expect(logs).toHaveLength(1);
  });

  it("chatStream 逐段输出 SSE 增量", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"你"}}]}',
      "",
      'data: {"choices":[{"delta":{"content":"好"}}]}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(stream, { status: 200 })));
    const parts: string[] = [];
    for await (const part of chatStream(DEEPSEEK, [{ role: "user", content: "hi" }], {}, () => {})) {
      parts.push(part);
    }
    expect(parts.join("")).toBe("你好");
  });

  it("vision 消息以数组形式透传并路由到视觉模型", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(okResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createModelClient(ZHIPU, () => {});
    await client.chat(
      [
        {
          role: "user",
          content: [
            { type: "text", text: "提取这个 JD 的岗位信息" },
            { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
          ],
        },
      ],
      { vision: true }
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("glm-4v-flash");
    expect(body.messages[0].content).toHaveLength(2);
    expect(body.messages[0].content[1].type).toBe("image_url");
  });

  it("未指定 visionModel 的供应商回退默认模型", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(okResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createModelClient(DEEPSEEK, () => {});
    const result = await client.chat([{ role: "user", content: "hi" }], { vision: true });
    expect(result.content).toBe("你好");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("deepseek-chat");
  });
});
