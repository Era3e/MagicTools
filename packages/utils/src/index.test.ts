import { describe, it, expect } from "vitest";
import { idempotencyKey, contentFingerprint, formatDate } from "./index";

describe("@mt/utils", () => {
  it("idempotencyKey 带前缀且唯一", () => {
    const a = idempotencyKey("evt");
    const b = idempotencyKey("evt");
    expect(a.startsWith("evt-")).toBe(true);
    expect(a).not.toBe(b);
  });

  it("contentFingerprint 相同内容指纹一致且长度 32", () => {
    const f = contentFingerprint("hello world");
    expect(f).toBe(contentFingerprint("hello world"));
    expect(f.length).toBe(32);
    expect(f).not.toBe(contentFingerprint("hello world!"));
  });

  it("formatDate 输出 ISO 日期", () => {
    expect(formatDate(new Date("2026-08-18T12:00:00Z"))).toBe("2026-08-18");
  });
});
