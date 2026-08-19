import { describe, it, expect, vi, afterEach } from "vitest";
import { ClawcvClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("ClawcvClient", () => {
  it("未配置 Key 时 isConfigured 为 false", () => {
    const c = new ClawcvClient({ baseUrl: "https://api.wondercv.com", apiKey: "" });
    expect(c.isConfigured()).toBe(false);
  });

  it("业务错误 code>=2000 抛错", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: 2100, message: "额度不足" }), { status: 200 })));
    const c = new ClawcvClient({ baseUrl: "https://api.wondercv.com", apiKey: "k" });
    await expect(c.analyze({ resume_text: "x" })).rejects.toThrow(/额度不足/);
  });

  it("429 退避重试后成功", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 1000, data: { score: 88 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = new ClawcvClient({ baseUrl: "https://api.wondercv.com", apiKey: "k" });
    const out = await c.analyze({ resume_text: "x" });
    expect(out).toEqual({ score: 88 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);

  it("携带 Bearer 与 X-API-Version 头", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 1000, data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = new ClawcvClient({ baseUrl: "https://api.wondercv.com", apiKey: "k" });
    await c.analyze({ resume_text: "x" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer k");
    expect(headers["X-API-Version"]).toBe("v1");
  });
});
