import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyIntent, embed, llmChat } from "./llm";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("classifyIntent", () => {
  it("关键词判别三意图", () => {
    expect(classifyIntent("查询一下这个月的数据")).toBe("data_query");
    expect(classifyIntent("你好")).toBe("chitchat_reject");
    expect(classifyIntent("我们的产品有哪些功能")).toBe("product_inquiry");
  });

  it("数据类关键词优先于问候", () => {
    expect(classifyIntent("你好，帮我查一下销售数据")).toBe("data_query");
  });
});

describe("llmChat", () => {
  it("桩模式意图返回 JSON 意图", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const out = await llmChat([
      { role: "system", content: "输出 JSON：{intent: ...}。{intent}" },
      { role: "user", content: "查询一下销售数据" },
    ]);
    const json = JSON.parse(out) as { intent: string };
    expect(json.intent).toBe("data_query");
  });

  it("真实模式调用 chat/completions 并解析意图", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "product_inquiry" }) } }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await llmChat([{ role: "user", content: "问个问题" }]);
    expect(JSON.parse(out).intent).toBe("product_inquiry");
  });
});

describe("embed", () => {
  it("桩模式返回确定性 1024 维向量", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const a = await embed(["测试文本"]);
    expect(a).toHaveLength(1);
    expect(a[0]).toHaveLength(1024);
    expect(a[0]).toEqual((await embed(["测试文本"]))[0]);
    expect(a[0]).not.toEqual((await embed(["另一段文本"]))[0]);
  });

  it("真实模式调用 /embeddings 并返回向量", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const vectors = await embed(["测试文本"]);
    expect(vectors[0]).toEqual([0.1, 0.2]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/embeddings");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("embedding-2");
    expect(body.input).toBe("测试文本");
  });
});
