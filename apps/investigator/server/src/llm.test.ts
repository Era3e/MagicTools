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
  it("结构化提示返回固定 schema 桩", async () => {
    const out = await llmChat([
      { role: "system", content: "输出结构化调研字段（requirements/painPoints/expectations/sentiment/priority/summary）" },
      { role: "user", content: "回答：报表太慢" },
    ]);
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed.requirements)).toBe(true);
    expect(parsed.sentiment).toBeTruthy();
    expect(parsed.priority).toBeTruthy();
  });

  it("总结提示返回 summary 桩", async () => {
    const out = await llmChat([
      { role: "system", content: "输出 JSON：{summary: 字符串}" },
      { role: "user", content: "一批回答" },
    ]);
    const parsed = JSON.parse(out);
    expect(typeof parsed.summary).toBe("string");
    expect(parsed.summary.length).toBeGreaterThan(0);
  });
});
