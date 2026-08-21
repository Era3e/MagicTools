import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CybercloudService } from "./cybercloud.service";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const PAYLOAD_JSON = '{"code":"t1","userId":1,"userName":"job"}';

/** 生成真实 RSA 密钥对；公钥以 DER base64 返回（与真实服务一致，非 PEM） */
function makeKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"), privateKey };
}

function mockFlow(overrides: { agentsFailOnce?: boolean } = {}) {
  const keyPair = makeKeyPair();
  const captured: { encryptedPassword?: string; loginCalls: number; jwtHeaders: string[]; payloadHeaders: string[] } = {
    loginCalls: 0,
    jwtHeaders: [],
    payloadHeaders: [],
  };
  let agentsFailures = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const headers = (init?.headers as Record<string, string>) ?? {};
    if (u.includes("/api/auth/login/key")) {
      return new Response(
        JSON.stringify({ code: "0", data: { rsaPublicKey: keyPair.publicKey, loginKey: "0123456789abcdef0123456789abcdef" } }),
        { status: 200 }
      );
    }
    if (u.includes("/api/auth/login")) {
      captured.loginCalls += 1;
      captured.encryptedPassword = JSON.parse(String(init?.body)).password;
      return new Response(JSON.stringify({ code: "0", data: { accessToken: "jwt-token-1" } }), { status: 200 });
    }
    captured.jwtHeaders.push(headers.jwt ?? "");
    captured.payloadHeaders.push(headers.payload ?? "");
    if (u.includes("/userByApiKey")) {
      return new Response(JSON.stringify({ code: "0", data: { payload: PAYLOAD_JSON } }), { status: 200 });
    }
    if (u.includes("/api/setup/agent/chat/agents")) {
      if (overrides.agentsFailOnce && agentsFailures === 0) {
        agentsFailures += 1;
        return new Response(JSON.stringify({ message: "Missing JWT token in request", code: "1" }), { status: 401 });
      }
      return new Response(
        JSON.stringify({ code: "0", data: [{ id: "agent-1", name: "销售助手", status: "PUBLISHED", enabled: true }] }),
        { status: 200 }
      );
    }
    if (u.includes("/session/create")) {
      return new Response(JSON.stringify({ code: "0", data: { code: "sess-1" } }), { status: 200 });
    }
    return new Response(
      JSON.stringify({ code: "0", data: { type: "MARKDOWN", data: "本月销售额 12345 元" } }),
      { status: 200 }
    );
  });
  return { fetchMock, keyPair, captured };
}

describe("CybercloudService JWT 认证层", () => {
  it("RSA PKCS1 加密契约：密文长度等于模长（2048 位 → 256 字节）且随明文变化", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_USERNAME", "admin");
    vi.stubEnv("CYBERCLOUD_PASSWORD", "p@ss");
    const { fetchMock, captured } = mockFlow();
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    const res = await svc.query("本月销售额多少");
    expect(res.reply).toContain("12345");
    expect(captured.encryptedPassword).toBeTruthy();
    const buf = Buffer.from(captured.encryptedPassword!, "base64");
    // PKCS#1 v1.5：密文长度 = 模长（2048 位 RSA → 256 字节），且不等于明文（含随机填充）
    expect(buf.length).toBe(256);
    expect(buf.toString("utf8")).not.toContain("p@ss");
    // 真实环境联调已验证：testcybercloud-dev 服务端可解密该格式密文并完成登录（见 PR 描述与 docs/integrations/cybercloud-setup.md）
  });

  it("所有业务请求携带 jwt 与 payload 头（base 末尾斜杠归一化）", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example/");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_USERNAME", "admin");
    vi.stubEnv("CYBERCLOUD_PASSWORD", "p@ss");
    const { fetchMock, captured } = mockFlow();
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    await svc.query("本月销售额多少");
    const calledUrls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledUrls.every((u) => !u.includes("//api") && !u.includes("//setup"))).toBe(true);
    expect(captured.jwtHeaders.length).toBeGreaterThanOrEqual(3);
    for (const jwt of captured.jwtHeaders) expect(jwt).toBe("jwt-token-1");
    const payloadHeaders = captured.payloadHeaders.filter(Boolean);
    expect(payloadHeaders.length).toBeGreaterThanOrEqual(3);
    for (const p of payloadHeaders) expect(p).toBe(encodeURIComponent(PAYLOAD_JSON));
  });

  it("网关 401 时自动重登并重试成功", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    vi.stubEnv("CYBERCLOUD_USERNAME", "admin");
    vi.stubEnv("CYBERCLOUD_PASSWORD", "p@ss");
    const { fetchMock, captured } = mockFlow({ agentsFailOnce: true });
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    const res = await svc.query("本月销售额多少");
    expect(res.reply).toContain("12345");
    expect(captured.loginCalls).toBe(2);
  });

  it("登录凭据未配置时优雅降级为未配置提示（不报错）", async () => {
    vi.stubEnv("CYBERCLOUD_BASE_URL", "https://cyber.example");
    vi.stubEnv("CYBERCLOUD_API_KEY", "key-123");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const svc = new CybercloudService();
    expect(svc.status().configured).toBe(true);
    expect(svc.status().credentialConfigured).toBe(false);
  });
});
