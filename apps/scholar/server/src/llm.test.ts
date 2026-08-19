import { afterEach, describe, expect, it, vi } from "vitest";
import { embed, llmChat } from "./llm";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("llm", () => {
  it("embed 桩模式返回确定性 1024 维向量", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const a = await embed(["测试文本"]);
    const b = await embed(["测试文本"]);
    expect(a).toHaveLength(1);
    expect(a[0]).toHaveLength(1024);
    expect(a[0]).toEqual(b[0]);
    const c = await embed(["另一段文本"]);
    expect(c[0]).not.toEqual(a[0]);
  });

  it("embed 真实模式调用 /embeddings 并返回向量", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const vectors = await embed(["测试文本"]);
    expect(vectors).toHaveLength(1);
    expect(vectors[0]).toEqual([0.1, 0.2]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/embeddings");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("embedding-2");
    expect(body.input).toBe("测试文本");
  });

  it("llmChat 图谱桩返回固定实体关系", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const out = await llmChat([
      { role: "system", content: "请抽取知识图谱 {graph}" },
      { role: "user", content: "内容……" },
    ]);
    const json = JSON.parse(out) as { entities: Array<Record<string, string>>; relations: Array<Record<string, string>> };
    expect(json.entities.length).toBeGreaterThan(0);
    expect(json.relations.length).toBeGreaterThan(0);
    expect(json.relations[0]).toHaveProperty("from");
    expect(json.relations[0]).toHaveProperty("to");
    expect(json.relations[0]).toHaveProperty("label");
  });
});
