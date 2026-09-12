import { describe, it, expect } from "vitest";
import {
  parseUsers,
  parseUserApps,
  verifyPassword,
  LoginThrottle,
  scryptHash,
  type UserRecord,
} from "./users";

describe("parseUsers", () => {
  it("解析 user:hash:role 三段格式", () => {
    const users = parseUsers("alice:" + "h1" + ":admin,bob:" + "h2");
    expect(users.get("alice")).toEqual({ hash: "h1", role: "admin" });
    expect(users.get("bob")).toEqual({ hash: "h2", role: "user" });
  });

  it("空与非法条目被忽略", () => {
    const users = parseUsers(",,alice:h1,:x,bob");
    expect(users.size).toBe(1);
    expect(users.has("alice")).toBe(true);
  });

  it("未配置返回空 Map", () => {
    expect(parseUsers(undefined).size).toBe(0);
    expect(parseUsers("").size).toBe(0);
  });
});

describe("parseUserApps", () => {
  it("解析 user:app1,app2 格式（分号分隔用户条目）", () => {
    const apps = parseUserApps("alice:applicant,scholar;bob:manager");
    expect(apps.get("alice")).toEqual(["applicant", "scholar"]);
    expect(apps.get("bob")).toEqual(["manager"]);
  });

  it("空条目忽略，未配置返回空 Map", () => {
    expect(parseUserApps(undefined).size).toBe(0);
    expect(parseUserApps(";:x;").size).toBe(0);
  });
});

describe("verifyPassword + scryptHash", () => {
  it("正确口令通过，错误口令拒绝", async () => {
    const hash = await scryptHash("s3cret-pw", "salt-a");
    expect(await verifyPassword("s3cret-pw", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("格式非法的哈希拒绝而非抛错", async () => {
    expect(await verifyPassword("x", "not-a-valid-hash")).toBe(false);
  });
});

describe("LoginThrottle", () => {
  it("5 次失败后锁定，锁期内正确口令也拒绝", async () => {
    const throttle = new LoginThrottle(5, 60_000);
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      expect(throttle.isLocked("alice", now)).toBe(false);
      throttle.recordFailure("alice", now);
    }
    expect(throttle.isLocked("alice", now)).toBe(true);
    expect(throttle.isLocked("bob", now)).toBe(false);
  });

  it("锁定期过后自动解锁", () => {
    const throttle = new LoginThrottle(5, 60_000);
    const now = Date.now();
    for (let i = 0; i < 5; i++) throttle.recordFailure("alice", now);
    expect(throttle.isLocked("alice", now + 61_000)).toBe(false);
  });

  it("成功登录清零计数", () => {
    const throttle = new LoginThrottle(5, 60_000);
    const now = Date.now();
    for (let i = 0; i < 4; i++) throttle.recordFailure("alice", now);
    throttle.recordSuccess("alice");
    throttle.recordFailure("alice", now);
    expect(throttle.isLocked("alice", now)).toBe(false);
  });
});

describe("UserRecord 类型完整性", () => {
  it("admin 角色可被识别", () => {
    const users = parseUsers("root:" + "h" + ":admin");
    const record: UserRecord | undefined = users.get("root");
    expect(record?.role).toBe("admin");
  });
});
