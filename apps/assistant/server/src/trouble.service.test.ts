import { afterEach, describe, expect, it, vi } from "vitest";
import { TroubleService, probeHealth } from "./trouble.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("probeHealth", () => {
  it("探测全部服务并容错单点失败", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("5001")) throw new Error("connection refused");
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const results = await probeHealth();
    expect(results.length).toBeGreaterThanOrEqual(8);
    const down = results.filter((r) => !r.ok);
    expect(down.length).toBeGreaterThanOrEqual(1);
    expect(down.some((r) => r.service.includes("gatherer"))).toBe(true);
  }, 30000);
});

describe("TroubleService", () => {
  it("桩模式生成排查建议", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    const svc = new TroubleService();
    const res = await svc.diagnose("系统报错了怎么排查");
    expect(res.reply).toContain("服务状态");
    expect(res.reply).toContain("建议");
  }, 30000);
});
