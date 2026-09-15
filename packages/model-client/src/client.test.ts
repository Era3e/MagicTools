import { describe, it, expect, vi, afterEach } from "vitest";
import { createModelClient, chatStream, runWithModelCallContext } from "./client";
import type { UsageLog } from "./types";
import { DEEPSEEK, ZHIPU } from "./providers";

const okResponse = {
  choices: [{ message: { content: "你好" } }],
  usage: { prompt_tokens: 10, completion_tokens: 2 },
};

afterEach(() => vi.unstubAllGlobals());

describe("model-client", () => {
  it("ZHIPU_MODEL 环境变量覆盖默认模型档位", async () => {
    vi.stubEnv("ZHIPU_MODEL", "glm-5.3");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createModelClient(ZHIPU, () => {});
    await client.chat([{ role: "user", content: "hi" }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("bigmodel.cn");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("glm-5.3");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
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

  it("chat 重试失败与最终成功分别形成调用记录", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(okResponse), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const logs: UsageLog[] = [];
    const client = createModelClient(DEEPSEEK, (usage) => logs.push(usage));
    await client.chat([{ role: "user", content: "hi" }]);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ status: "error", attempt: 1, attempts: 1, errorCode: "Error" });
    expect(logs[1]).toMatchObject({ status: "success", attempt: 2, attempts: 2, inputTokens: 10, outputTokens: 2, tokenSource: "provider" });
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

  it("chatStream 读取最终 usage，且缺失时显式 unknown", async () => {
    const makeStream = (withUsage: boolean) => {
      const sse = [
        'data: {"choices":[{"delta":{"content":"你"}}]}',
        "",
        `data: ${JSON.stringify({ choices: [], ...(withUsage ? { usage: { prompt_tokens: 8, completion_tokens: 2 } } : {})})}`,
        "",
        "data: [DONE]",
        "",
      ].join("\n");
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sse));
          controller.close();
        },
      });
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(makeStream(true), { status: 200 })));
    let usage: UsageLog | undefined;
    for await (const part of chatStream(DEEPSEEK, [{ role: "user", content: "hi" }], {}, (record) => { usage = record; })) {
      expect(part).toBe("你");
    }
    expect(usage).toMatchObject({ inputTokens: 8, outputTokens: 2, tokenSource: "provider" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response(makeStream(false), { status: 200 })));
    usage = undefined;
    for await (const part of chatStream(DEEPSEEK, [{ role: "user", content: "hi" }], {}, (record) => { usage = record; })) {
      expect(typeof part).toBe("string");
    }
    expect(usage).toMatchObject({ inputTokens: null, outputTokens: null, tokenSource: "unknown" });
  });

  it("chatStream 消费方提前退出会取消底层请求并记录 cancelled", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'));
      },
    });
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
      signals.push(init.signal!);
      return Promise.resolve(new Response(stream, { status: 200 }));
    }));
    const logs: UsageLog[] = [];

    for await (const part of chatStream(DEEPSEEK, [{ role: "user", content: "hi" }], {}, (record) => logs.push(record))) {
      expect(part).toBe("你");
      break;
    }

    expect(signals[0].aborted).toBe(true);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: "cancelled", errorCode: "cancelled", cancelled: true });
  });

  it("timeout 会中止底层请求并记录 timeout", async () => {
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      signals.push(init.signal!);
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const logs: UsageLog[] = [];
    const client = createModelClient(DEEPSEEK, (usage) => logs.push(usage));
    await expect(client.chat([{ role: "user", content: "hi" }], { timeoutMs: 10 })).rejects.toThrow(/超时|aborted/i);
    expect(signals[0].aborted).toBe(true);
    expect(logs[0]).toMatchObject({ status: "timeout", errorCode: "timeout", cancelled: false });
  });

  it("外部取消会中止底层请求并记录 cancelled", async () => {
    const controller = new AbortController();
    const signals: AbortSignal[] = [];
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      signals.push(init.signal!);
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const logs: UsageLog[] = [];
    const client = createModelClient(DEEPSEEK, (usage) => logs.push(usage));
    const pending = client.chat([{ role: "user", content: "hi" }], { signal: controller.signal });
    setTimeout(() => controller.abort(new Error("user cancelled")), 10);
    await expect(pending).rejects.toThrow(/user cancelled|aborted/i);
    expect(signals[0].aborted).toBe(true);
    expect(logs[0]).toMatchObject({ status: "cancelled", errorCode: "cancelled", cancelled: true });
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

  it("embed 调用 embedding 模型并返回向量数组", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = createModelClient(ZHIPU, () => {});
    const vectors = await client.embed(["测试文本"]);
    expect(vectors).toHaveLength(1);
    expect(vectors[0]).toEqual([0.1, 0.2, 0.3]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/embeddings");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("embedding-2");
    expect(body.input).toBe("测试文本");
  });

  it("embed 记录供应商 usage 并继承异步上下文", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1] }], usage: { prompt_tokens: 4 } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const logs: UsageLog[] = [];
    const client = createModelClient(ZHIPU, (usage) => logs.push(usage));
    await runWithModelCallContext({ service: "assistant", taskId: "task-9", traceId: "trace-9" }, () =>
      client.embed(["测试文本"])
    );
    expect(logs[0]).toMatchObject({
      service: "assistant",
      operation: "embedding",
      effectiveModel: "embedding-2",
      inputTokens: 4,
      outputTokens: null,
      tokenSource: "provider",
      taskId: "task-9",
      traceId: "trace-9",
    });
  });
});
