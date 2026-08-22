import { describe, expect, it } from "vitest";
import { parseJson } from "./json";

describe("parseJson", () => {
  it("纯 JSON 直接解析", () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("markdown 代码围栏包裹的 JSON", () => {
    const raw = "\u0060\u0060\u0060json\n{\"intent\":\"data_query\",\"confidence\":0.9}\n\u0060\u0060\u0060";
    expect(parseJson(raw)).toEqual({ intent: "data_query", confidence: 0.9 });
  });

  it("夹杂解释文字的 JSON（提取首个花括号块）", () => {
    const raw = "好的，分类结果如下：{\"domain\":\"cybercloud\",\"intent\":\"data_query\",\"confidence\":0.95} 希望有帮助。";
    const parsed = parseJson(raw) as Record<string, unknown>;
    expect(parsed.domain).toBe("cybercloud");
    expect(parsed.intent).toBe("data_query");
    expect(parsed.confidence).toBe(0.95);
  });

  it("无引号键的模型输出", () => {
    const raw = '{domain: "chitchat", intent: "chitchat_reject", confidence: 0.98}';
    const parsed = parseJson(raw) as Record<string, unknown>;
    expect(parsed.domain).toBe("chitchat");
    expect(parsed.intent).toBe("chitchat_reject");
    expect(parsed.confidence).toBe(0.98);
  });

  it("完全无法解析时抛错", () => {
    expect(() => parseJson("这不是 JSON")).toThrow();
  });
});
