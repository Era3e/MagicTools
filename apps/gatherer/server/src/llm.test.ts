import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { llmChat } from "./llm";

const original = process.env.MT_LLM_STUB;

beforeAll(() => { process.env.MT_LLM_STUB = "1"; });
afterAll(() => { delete process.env.MT_LLM_STUB; if (original) process.env.MT_LLM_STUB = original; });

describe("llmChat stub 模式", () => {
  it("富化提示返回 summary/category/keywords 桩", async () => {
    const out = await llmChat([{ role: "system", content: "输出 JSON：{summary: 字符串, category: 字符串, keywords: 数组}" }]);
    const parsed = JSON.parse(out);
    expect(typeof parsed.summary).toBe("string");
    expect(typeof parsed.category).toBe("string");
    expect(Array.isArray(parsed.keywords)).toBe(true);
  });
});
