import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionService } from "./action.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ActionService", () => {
  it("桩模式动作解析与执行回执", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    vi.stubEnv("ACTION_STUB", "1");
    const svc = new ActionService();
    const res = await svc.execute("帮我创建一个需求：支持导出功能");
    expect(res.actionResult.ok).toBe(true);
    expect(res.actionResult.action).toBe("create_requirement");
    expect(res.reply).toContain("桩模式");
  });

  it("桩模式采集动作解析", async () => {
    vi.stubEnv("MT_LLM_STUB", "1");
    vi.stubEnv("ACTION_STUB", "1");
    const svc = new ActionService();
    const res = await svc.execute("触发一次信息采集");
    expect(res.actionResult.action).toBe("trigger_collect");
  });

  it("真实模式创建需求经网关落 Manager", async () => {
    vi.stubEnv("MT_PROD", "1");
    vi.stubEnv("GATEWAY_TOKEN", "runtime-test-token");
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      urls.push(String(url));
      if (String(url).includes("chat/completions")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: "create_requirement", params: { title: "测试需求", description: "描述" } }) } }] }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ id: "req-1", title: "测试需求" }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const svc = new ActionService();
    const res = await svc.execute("创建一个需求叫测试需求");
    expect(res.actionResult.ok).toBe(true);
    expect(res.actionResult.requirementId).toBe("req-1");
    expect(urls.some((u) => u.includes("/api/manager/requirements"))).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://gateway:3000/api/manager/requirements", expect.objectContaining({ headers: { "Content-Type": "application/json", "x-access-token": "runtime-test-token" } }));
  });

  it("服务 token 优先于共享 GATEWAY_TOKEN，缺省逐级回落", async () => {
    const gatewayHeaders = (mock: ReturnType<typeof vi.fn>): unknown => {
      const call = mock.mock.calls.find(([url]) => String(url).includes("/api/manager/requirements"));
      return call ? (call[1] as RequestInit).headers : undefined;
    };
    const setup = async () => {
      vi.stubEnv("MT_PROD", "1");
      const fetchMock = vi.fn(async (url: string) => {
        if (String(url).includes("chat/completions")) {
          return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: "create_requirement", params: { title: "t" } }) } }] }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "r" }), { status: 201 });
      });
      vi.stubGlobal("fetch", fetchMock);
      await new ActionService().execute("创建一个需求叫t");
      return fetchMock;
    };
    vi.stubEnv("GATEWAY_ASSISTANT_SERVICE_TOKEN", "svc-a");
    vi.stubEnv("GATEWAY_TOKEN", "fallback-token");
    let fetchMock = await setup();
    expect(gatewayHeaders(fetchMock)).toMatchObject({ "x-access-token": "svc-a" });
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv("MT_PROD", "1");
    vi.stubEnv("GATEWAY_TOKEN", "fallback-only");
    fetchMock = await setup();
    expect(gatewayHeaders(fetchMock)).toMatchObject({ "x-access-token": "fallback-only" });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("触发采集缺 sourceId 时友好提示", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("chat/completions")) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: "trigger_collect", params: {} }) } }] }),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const svc = new ActionService();
    const res = await svc.execute("触发采集");
    expect(res.actionResult.ok).toBe(false);
    expect(res.reply).toContain("信息源 ID");
  });
});
