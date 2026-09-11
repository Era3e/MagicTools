import { describe, expect, it } from "vitest";
import { extractApiErrorMessage } from "./api-errors";

describe("extractApiErrorMessage（网关/直连双形态）", () => {
  it("网关扁平形态：{error, reason, line} → reason + 行号", () => {
    expect(extractApiErrorMessage({ error: "parse_failed", reason: "组件不在画布白名单: h1", line: 8 }, 400))
      .toBe("组件不在画布白名单: h1 （第 8 行）");
  });

  it("直连 NestJS 形态：{message: {error, reason, line}} → 同样提取", () => {
    expect(extractApiErrorMessage({ message: { error: "parse_failed", reason: "语法错误", line: 1 }, statusCode: 400 }, 400))
      .toBe("语法错误 （第 1 行）");
  });

  it("纯字符串 message 原样返回", () => {
    expect(extractApiErrorMessage({ message: "name 与 code 必填" }, 400)).toBe("name 与 code 必填");
  });

  it("无有效信息时回退到状态码", () => {
    expect(extractApiErrorMessage({}, 502)).toBe("请求失败 502");
    expect(extractApiErrorMessage(undefined, 500)).toBe("请求失败 500");
  });
});
