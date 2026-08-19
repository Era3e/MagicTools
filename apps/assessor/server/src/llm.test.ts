import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { llmChat } from "./llm";

const original = process.env.MT_LLM_STUB;

beforeAll(() => {
  process.env.MT_LLM_STUB = "1";
});
afterAll(() => {
  delete process.env.MT_LLM_STUB;
  if (original) process.env.MT_LLM_STUB = original;
});

describe("llmChat stub 模式", () => {
  it("分析提示返回 analysis 桩", async () => {
    const out = await llmChat([{ role: "system", content: "你是需求分析助手，输出 JSON：{analysis: 字符串}" }]);
    const parsed = JSON.parse(out);
    expect(typeof parsed.analysis).toBe("string");
    expect(parsed.analysis.length).toBeGreaterThan(0);
  });

  it("方案提示返回 design 桩", async () => {
    const out = await llmChat([{ role: "system", content: "你是方案设计助手，输出 JSON：{design: 字符串}" }]);
    const parsed = JSON.parse(out);
    expect(typeof parsed.design).toBe("string");
  });
});
