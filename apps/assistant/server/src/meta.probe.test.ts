import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CybercloudService } from "./cybercloud.service";

const PAYLOAD_JSON = '{"code":"t1"}';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function probeFetch(opts: { agentsFail?: boolean; payloadFail?: boolean }) {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const rsaPublicKey = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  return vi.fn(async (url: string) => {
    if (String(url).includes("/api/auth/login/key")) return new Response(JSON.stringify({ code: "0", data: { rsaPublicKey, loginKey: "0123456789abcdef0123456789abcdef" } }), { status: 200 });
    if (String(url).includes("/api/auth/login")) return new Response("{}", { status: 200, headers: { "Set-Cookie": "jwt=j; Path=/" } });
    if (String(url).includes("/userByApiKey")) {
      if (opts.payloadFail) return new Response(JSON.stringify({ code: "1", message: "无效 ApiKey" }), { status: 200 });
      return new Response(JSON.stringify({ code: "0", data: { payload: PAYLOAD_JSON } }), { status: 200 });
    }
    if (String(url).includes("/agents")) {
      if (opts.agentsFail) return new Response(JSON.stringify({}), { status: 500 });
      return new Response(JSON.stringify({ code: "0", data: [{ id: "a1" }, { id: "a2" }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ code: "0", data: [] }), { status: 200 });
  });
}

describe("cybercloud 探活 probe", () => {
  it("全通：gatewayOk/authOk/agentsReachable + agentCount", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key");
    vi.stubEnv("CYBERCLOUD_USERNAME", "u");
    vi.stubEnv("CYBERCLOUD_PASSWORD", "p");
    vi.stubGlobal("fetch", probeFetch({}));
    const svc = new CybercloudService();
    const probe = await svc.probe();
    expect(probe.gatewayOk).toBe(true);
    expect(probe.authOk).toBe(true);
    expect(probe.agentsReachable).toBe(true);
    expect(probe.agentCount).toBe(2);
    expect(probe.errorDomain).toBeNull();
  });
  it("apiKey 无效 → errorDomain=auth", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "bad");
    vi.stubEnv("CYBERCLOUD_JWT", "j");
    vi.stubGlobal("fetch", probeFetch({ payloadFail: true }));
    const svc = new CybercloudService();
    const probe = await svc.probe();
    expect(probe.authOk).toBe(false);
    expect(probe.errorDomain).toBe("auth");
  });
  it("列智能体 500 → errorDomain=agent", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key");
    vi.stubEnv("CYBERCLOUD_JWT", "j");
    vi.stubGlobal("fetch", probeFetch({ agentsFail: true }));
    const svc = new CybercloudService();
    const probe = await svc.probe();
    expect(probe.agentsReachable).toBe(false);
    expect(probe.errorDomain).toBe("agent");
  });
  it("探活结果 60s 缓存", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key");
    vi.stubEnv("CYBERCLOUD_JWT", "j");
    const fetchMock = probeFetch({});
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    await svc.probe();
    await svc.probe();
    const agentsCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/agents")).length;
    expect(agentsCalls).toBe(1);
  });
  it("桩模式探活直接全绿", async () => {
    vi.stubEnv("CYBERCLOUD_STUB", "1");
    const svc = new CybercloudService();
    const probe = await svc.probe();
    expect(probe.gatewayOk).toBe(true);
    expect(probe.errorDomain).toBeNull();
  });
});
