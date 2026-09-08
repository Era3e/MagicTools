import { afterEach, describe, expect, it, vi } from "vitest";
import { CybercloudService } from "./cybercloud.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const PAYLOAD_JSON = '{"code":"t1","userId":1,"userName":"job"}';

function mockCybercloudFlow() {
  const urls: string[] = [];
  const headers: Array<Record<string, string>> = [];
  let payloadCalls = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    urls.push(String(url));
    headers.push((init?.headers as Record<string, string>) ?? {});
    if (String(url).includes("/api/auth/login/key")) {
      return new Response(
        JSON.stringify({ code: "0", data: { rsaPublicKey: "pem", loginKey: "k" } }),
        { status: 200 }
      );
    }
    if (String(url).includes("/api/auth/login")) {
      return new Response(JSON.stringify({ code: "0", data: { accessToken: "" } }), {
        status: 200,
        headers: { "Set-Cookie": "jwt=jwt-1; Path=/; HttpOnly" },
      });
    }
    if (String(url).includes("/userByApiKey")) {
      payloadCalls += 1;
      return new Response(JSON.stringify({ code: "0", data: { payload: PAYLOAD_JSON } }), { status: 200 });
    }
    if (String(url).includes("/api/setup/agent/chat/agents")) {
      return new Response(
        JSON.stringify({ code: "0", data: [{ id: "agent-1", name: "销售数据助手", status: "PUBLISHED", enabled: true }] }),
        { status: 200 }
      );
    }
    if (String(url).includes("/session/create")) {
      return new Response(JSON.stringify({ code: "0", data: { code: "sess-1" } }), { status: 200 });
    }
    if (String(url).includes("/agent/chat/block")) {
      return new Response(
        JSON.stringify({ code: "0", data: { type: "MARKDOWN", data: "本月销售额 12345 元" } }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ code: "0", data: [{ id: "agent-1" }] }), { status: 200 });
  });
  return { fetchMock, urls, headers, getPayloadCalls: () => payloadCalls };
}

describe("CybercloudService（真实契约）", () => {
  it("桩模式返回固定数据集", async () => {
    vi.stubEnv("CYBERCLOUD_STUB", "1");
    const svc = new CybercloudService();
    const res = await svc.query("查询销售数据");
    expect(res.reply).toContain("12345");
    expect(svc.status().stub).toBe(true);
  });

  it("真实模式按契约全流程：apiKey 换 payload → 列智能体 → 建会话 → block 对话", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    vi.stubEnv("CYBERCLOUD_USERNAME", "admin");
    vi.stubEnv("CYBERCLOUD_PASSWORD", "p@ss");
    const { fetchMock, urls, headers } = mockCybercloudFlow();
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    const res = await svc.query("本月销售额多少");
    expect(res.reply).toContain("12345");
    expect(urls.some((u) => u.includes("/api/auth/setup/user/access/token/userByApiKey"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/setup/agent/chat/block"))).toBe(true);
    const agentsCall = headers.find((_, i) => urls[i].includes("/agents"));
    expect(agentsCall).toBeTruthy();
    expect(agentsCall!.payload).toBe(encodeURIComponent(PAYLOAD_JSON));
    const blockCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/agent/chat/block"));
    const body = JSON.parse(String((blockCall![1] as RequestInit).body));
    expect(body.message).toBe("本月销售额多少");
    expect(body.sessionCode).toBe("sess-1");
  });

  it("payload 与会话复用缓存（第二次查询不再换 payload/建会话）", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    const { fetchMock, getPayloadCalls } = mockCybercloudFlow();
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    await svc.query("第一次查询");
    await svc.query("第二次查询");
    expect(getPayloadCalls()).toBe(1);
  });

  it("METRIC_CHART 类型返回图表数据 JSON", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/userByApiKey")) {
        return new Response(JSON.stringify({ code: "0", data: { payload: PAYLOAD_JSON } }), { status: 200 });
      }
      if (String(url).includes("/agents")) {
        return new Response(JSON.stringify({ code: "0", data: [{ id: "agent-1", name: "A", status: "PUBLISHED", enabled: true }] }), { status: 200 });
      }
      if (String(url).includes("/session/create")) {
        return new Response(JSON.stringify({ code: "0", data: { code: "sess-1" } }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ code: "0", data: { type: "METRIC_CHART", data: { metric: "sales", values: [1, 2, 3] } } }),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    const res = await svc.query("销售趋势");
    expect(res.reply).toContain("METRIC_CHART");
    expect(res.reply).toContain("sales");
  });

  it("cybercloud 返回业务错误时透出错误信息", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: "1", message: "无效 ApiKey ！" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    await expect(svc.query("查询")).rejects.toThrow();
  });

  it("query 返回结构化元数据（sseType/latencyMs/agentId）", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    const { fetchMock } = mockCybercloudFlow();
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    const res = await svc.query("本月销售额多少");
    expect(res.meta.sseType).toBe("MARKDOWN");
    expect(res.meta.agentId).toBe("agent-1");
    expect(res.meta.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("SSE ERROR 保留错误标记不降维（meta.sseType=ERROR）", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/userByApiKey")) {
        return new Response(JSON.stringify({ code: "0", data: { payload: PAYLOAD_JSON } }), { status: 200 });
      }
      if (String(url).includes("/agents")) {
        return new Response(JSON.stringify({ code: "0", data: [{ id: "agent-1", name: "A", status: "PUBLISHED", enabled: true }] }), { status: 200 });
      }
      if (String(url).includes("/session/create")) {
        return new Response(JSON.stringify({ code: "0", data: { code: "sess-1" } }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: "0", data: { type: "ERROR", data: "工具执行失败" } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    const res = await svc.query("查询");
    expect(res.meta.sseType).toBe("ERROR");
    expect(res.reply).toContain("工具执行失败");
    expect(res.meta.error).toContain("工具执行失败");
  });

  it("桩模式智能体答由 CYBERCLOUD_STUB_AGENT_ANSWER 控制", async () => {
    vi.stubEnv("CYBERCLOUD_STUB", "1");
    const svc = new CybercloudService();
    const ok = await svc.query("问");
    expect(ok.meta.sseType).toBe("MARKDOWN");
    vi.stubEnv("CYBERCLOUD_STUB_AGENT_ANSWER", "99999");
    const diff = await svc.query("问");
    expect(diff.reply).toContain("99999");
    vi.stubEnv("CYBERCLOUD_STUB_AGENT_ANSWER", "__FAIL__");
    await expect(svc.query("问")).rejects.toThrow();
  });

  it("postApi 供直连复用（带 jwt+payload 头）", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_JWT", "jwt-1");
    const { fetchMock, urls, headers } = mockCybercloudFlow();
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    const res = await svc.postApi<Array<unknown>>("/api/setup/report/indicators/list", {});
    expect(res).toEqual([{ id: "agent-1" }]);
    const i = urls.findIndex((u) => u.includes("indicators/list"));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(headers[i].jwt).toBe("jwt-1");
    expect(headers[i].payload).toBe(encodeURIComponent(PAYLOAD_JSON));
  });
});
