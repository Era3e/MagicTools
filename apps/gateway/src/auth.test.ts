import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { createAuthMiddleware } from "./auth";
import { scryptHash } from "./users";

const SECRET = "session-secret";

async function buildApp(env: Record<string, string>) {
  const app = express();
  app.use(createAuthMiddleware(env, { now: () => Date.now() }));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/applicant/", (_req, res) => res.send("applicant-web"));
  app.get("/scholar/", (_req, res) => res.send("scholar-web"));
  app.get("/api/manager/requirements", (_req, res) => res.json({ user: res.getHeader("x-gateway-user") ?? null }));
  return app;
}

describe("auth 中间件", () => {
  it("未配置 GATEWAY_USERS 时行为与现状一致（token 通道保留）", async () => {
    const app = await buildApp({ GATEWAY_TOKEN: "secret" });
    await request(app).get("/health").expect(401);
    await request(app).get("/health").set("X-Access-Token", "secret").expect(200);
  });

  it("未配置任何认证时全放行", async () => {
    const app = await buildApp({});
    await request(app).get("/health").expect(200);
  });

  it("配置 USERS 后浏览器 HTML 请求重定向登录页", async () => {
    const hash = await scryptHash("pw", "salt");
    const app = await buildApp({ GATEWAY_USERS: "alice:" + hash, GATEWAY_SESSION_SECRET: SECRET });
    const res = await request(app).get("/applicant/").set("Accept", "text/html").expect(302);
    expect(res.headers.location).toBe("/login");
  });

  it("API 请求无凭证返回 401 JSON", async () => {
    const hash = await scryptHash("pw", "salt");
    const app = await buildApp({ GATEWAY_USERS: "alice:" + hash, GATEWAY_SESSION_SECRET: SECRET });
    const res = await request(app).get("/api/manager/requirements").expect(401);
    expect(res.body.code).toBe(401);
  });

  it("GATEWAY_TOKEN 服务通道并行放行且带服务身份头", async () => {
    const hash = await scryptHash("pw", "salt");
    const app = await buildApp({
      GATEWAY_USERS: "alice:" + hash,
      GATEWAY_SESSION_SECRET: SECRET,
      GATEWAY_TOKEN: "svc-token",
    });
    const res = await request(app).get("/api/manager/requirements").set("X-Access-Token", "svc-token").expect(200);
    expect(res.body.user).toBe("service");
  });

  it("登录获得会话 cookie 后可访问且透传用户名", async () => {
    const hash = await scryptHash("pw", "salt");
    const app = await buildApp({ GATEWAY_USERS: "alice:" + hash, GATEWAY_SESSION_SECRET: SECRET });
    const login = await request(app).post("/login").send("username=alice&password=pw");
    expect(login.status).toBe(302);
    const cookie = login.headers["set-cookie"]![0].split(";")[0];
    expect(cookie).toContain("mt_session=");
    const res = await request(app).get("/api/manager/requirements").set("Cookie", cookie).expect(200);
    expect(res.body.user).toBe("alice");
  });

  it("USER_APPS 限定应用外访问返回 403", async () => {
    const hash = await scryptHash("pw", "salt");
    const app = await buildApp({
      GATEWAY_USERS: "alice:" + hash,
      GATEWAY_SESSION_SECRET: SECRET,
      GATEWAY_USER_APPS: "alice:scholar",
    });
    const login = await request(app).post("/login").send("username=alice&password=pw");
    const cookie = login.headers["set-cookie"]![0].split(";")[0];
    await request(app).get("/scholar/").set("Cookie", cookie).expect(200);
    await request(app).get("/applicant/").set("Cookie", cookie).expect(403);
  });

  it("admin 角色不受 USER_APPS 限制", async () => {
    const hash = await scryptHash("pw", "salt");
    const app = await buildApp({
      GATEWAY_USERS: "root:" + hash + ":admin",
      GATEWAY_SESSION_SECRET: SECRET,
      GATEWAY_USER_APPS: "root:scholar",
    });
    const login = await request(app).post("/login").send("username=root&password=pw");
    const cookie = login.headers["set-cookie"]![0].split(";")[0];
    await request(app).get("/applicant/").set("Cookie", cookie).expect(200);
  });

  it("服务 token（SERVICE_TOKENS）放行全部应用", async () => {
    const hash = await scryptHash("pw", "salt");
    const app = await buildApp({
      GATEWAY_USERS: "alice:" + hash,
      GATEWAY_SESSION_SECRET: SECRET,
      GATEWAY_USER_APPS: "alice:scholar",
      GATEWAY_SERVICE_TOKENS: "assistant:svc-a",
    });
    await request(app).get("/applicant/").set("X-Access-Token", "svc-a").expect(200);
  });

  it("配置 USERS 但缺 SESSION_SECRET 时启动即拒绝", async () => {
    const hash = await scryptHash("pw", "salt");
    expect(() => createAuthMiddleware({ GATEWAY_USERS: "alice:" + hash }, { now: () => Date.now() })).toThrow();
  });

  it("登录页本身无需认证", async () => {
    const hash = await scryptHash("pw", "salt");
    const app = await buildApp({ GATEWAY_USERS: "alice:" + hash, GATEWAY_SESSION_SECRET: SECRET });
    await request(app).get("/login").expect(200);
    await request(app).post("/logout").expect(302);
  });
});
