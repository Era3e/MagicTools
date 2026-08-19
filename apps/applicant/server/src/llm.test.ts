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
  it("返回可解析的 JSON 字符串", async () => {
    const out = await llmChat([{ role: "user", content: "任意输入" }]);
    const parsed = JSON.parse(out);
    expect(typeof parsed).toBe("object");
    expect(parsed.stub).toBe(true);
  });

  it("JD 提示返回岗位结构化桩", async () => {
    const out = await llmChat([
      { role: "system", content: "提取岗位信息" },
      { role: "user", content: "JD 文本：某公司招聘" },
    ]);
    const parsed = JSON.parse(out);
    expect(parsed.company).toBeTruthy();
    expect(Array.isArray(parsed.requirements)).toBe(true);
  });

  it("简历分析提示返回 score 桩", async () => {
    const out = await llmChat([
      { role: "system", content: "输出 JSON：{score: 数字}" },
      { role: "user", content: "分析这份简历" },
    ]);
    const parsed = JSON.parse(out);
    expect(typeof parsed.score).toBe("number");
  });

  it("匹配提示返回 match_score 桩", async () => {
    const out = await llmChat([
      { role: "system", content: "输出 JSON：{match_score: 0-100 数字}" },
      { role: "user", content: "简历：x；JD：y" },
    ]);
    const parsed = JSON.parse(out);
    expect(typeof parsed.match_score).toBe("number");
  });
});
