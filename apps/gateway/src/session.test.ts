import { describe, it, expect } from "vitest";
import { signSession, verifySession, SESSION_COOKIE } from "./session";

const SECRET = "test-session-secret-0123456789abcdef";

describe("signSession / verifySession", () => {
  it("签名会话可验证并还原用户与角色", () => {
    const cookie = signSession({ user: "alice", role: "admin" }, SECRET, 1000, 2_000_000);
    const session = verifySession(cookie, SECRET, 1_500_000);
    expect(session).not.toBeNull();
    expect(session?.user).toBe("alice");
    expect(session?.role).toBe("admin");
  });

  it("过期会话拒绝", () => {
    const cookie = signSession({ user: "alice", role: "user" }, SECRET, 1000, 1_000_000);
    expect(verifySession(cookie, SECRET, 2_000_000)).toBeNull();
  });

  it("篡改用户名/过期时间后签名校验失败", () => {
    const cookie = signSession({ user: "alice", role: "user" }, SECRET, 1000, 2_000_000);
    const parts = cookie.split(".");
    const payload = Buffer.from(parts[0], "base64url");
    const forged = JSON.parse(payload.toString("utf8"));
    forged.user = "admin";
    forged.exp = 9_999_999;
    const forgedCookie =
      Buffer.from(JSON.stringify(forged)).toString("base64url") + "." + parts[1];
    expect(verifySession(forgedCookie, SECRET, 1_500_000)).toBeNull();
  });

  it("换密钥后拒绝", () => {
    const cookie = signSession({ user: "alice", role: "user" }, SECRET, 1000, 1_000_000);
    expect(verifySession(cookie, "other-secret", 1_500_000)).toBeNull();
  });

  it("畸形 cookie 拒绝", () => {
    expect(verifySession("garbage", SECRET, 1_000)).toBeNull();
    expect(verifySession("a.b", SECRET, 1_000)).toBeNull();
    expect(verifySession("", SECRET, 1_000)).toBeNull();
  });
});

describe("会话滑动续期", () => {
  it("剩余不足三分之一时长时需要续期", () => {
    const ttl = 43_200_000;
    const issued = 1_000_000;
    const cookie = signSession({ user: "alice", role: "user" }, SECRET, issued, ttl);
    const session = verifySession(cookie, SECRET, issued + (ttl * 2) / 3 + 1);
    expect(session?.needsRefresh(issued + (ttl * 2) / 3 + 1, ttl)).toBe(true);
    expect(session?.needsRefresh(issued + ttl / 2, ttl)).toBe(false);
  });
});

describe("SESSION_COOKIE", () => {
  it("常量导出供中间件使用", () => {
    expect(SESSION_COOKIE).toBe("mt_session");
  });
});
