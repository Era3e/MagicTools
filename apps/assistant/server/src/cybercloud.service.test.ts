import { afterEach, describe, expect, it, vi } from "vitest";
import { CybercloudService } from "./cybercloud.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("CybercloudService", () => {
  it("桩模式返回固定数据集", async () => {
    vi.stubEnv("CYBERCLOUD_STUB", "1");
    const svc = new CybercloudService();
    const res = await svc.query("查询销售数据");
    expect(res.reply).toContain("12345");
    expect(svc.status().stub).toBe(true);
  });

  it("真实模式生成查询参数并请求数据源再格式化", async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      urls.push(String(url));
      if (String(url).includes("chat/completions")) {
        const body = JSON.parse(String(init?.body));
        const system = String(body.messages[0].content);
        const content = system.includes("{params")
          ? JSON.stringify({ endpoint: "/api/v1/data/query", params: { metric: "sales" } })
          : JSON.stringify({ answer: "本月销售额 12345 元" });
        return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ value: 12345 }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "test-key");
    const svc = new CybercloudService();
    const res = await svc.query("本月销售额多少");
    expect(res.reply).toContain("12345");
    expect(urls.some((u) => u.includes("cyber.example/api/v1/data/query"))).toBe(true);
  });

  it("数据源返回非 2xx 时抛错", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("chat/completions")) {
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ endpoint: "/api/v1/x", params: {} }) } }] }), { status: 200 });
      }
      return new Response("内部错误", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "test-key");
    const svc = new CybercloudService();
    await expect(svc.query("查询")).rejects.toThrow();
  });
});
