import { describe, it, expect, vi, afterEach } from "vitest";
import { ClawcvClient, type ClawcvAlert } from "./client";

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

  // === D-08 告警场景 ===

  it("402 配额耗尽 → 触发 quota_exhausted 告警", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "余额不足" }), { status: 402 }));
    vi.stubGlobal("fetch", fetchMock);
    const alerts: ClawcvAlert[] = [];
    const c = new ClawcvClient({
      baseUrl: "https://api.wondercv.com",
      apiKey: "k",
      onAlert: (a) => alerts.push(a),
    });
    await expect(c.analyze({ resume_text: "x" })).rejects.toThrow(/402/);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("quota_exhausted");
    expect(alerts[0].statusCode).toBe(402);
    expect(alerts[0].endpoint).toContain("/analyze");
  });

  it("401 Key 过期 → 触发 key_expired 告警", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const alerts: ClawcvAlert[] = [];
    const c = new ClawcvClient({
      baseUrl: "https://api.wondercv.com",
      apiKey: "k",
      onAlert: (a) => alerts.push(a),
    });
    await expect(c.analyze({ resume_text: "x" })).rejects.toThrow(/401/);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("key_expired");
  });

  it("429 限流 → 触发 rate_limited 告警（节流：同类同 endpoint 5min 内只发一次）", async () => {
    // 两次 429 都在重试链上，只触发一次告警（节流）
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 1000, data: { score: 88 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const alerts: ClawcvAlert[] = [];
    const c = new ClawcvClient({
      baseUrl: "https://api.wondercv.com",
      apiKey: "k",
      onAlert: (a) => alerts.push(a),
    });
    await c.analyze({ resume_text: "x" });
    // 3 次 fetch 调用，但同 endpoint 同类型告警被节流为 1 次
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(alerts.filter((a) => a.type === "rate_limited")).toHaveLength(1);
  }, 10000);

  it("业务错误 code>=2100 → 也触发 quota_exhausted 告警", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 2100, message: "额度不足" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const alerts: ClawcvAlert[] = [];
    const c = new ClawcvClient({
      baseUrl: "https://api.wondercv.com",
      apiKey: "k",
      onAlert: (a) => alerts.push(a),
    });
    await expect(c.analyze({ resume_text: "x" })).rejects.toThrow(/额度不足/);
    expect(alerts[0].type).toBe("quota_exhausted");
    expect(alerts[0].statusCode).toBe(200);
  });
});
