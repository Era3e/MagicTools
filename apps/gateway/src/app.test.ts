import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import type { AddressInfo } from "node:net";
import { createGateway } from "./app";

describe("gateway app", () => {
  it("未配置 token 时放行 /health", async () => {
    const app = createGateway({}, {});
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("up");
  });

  it("配置 token 后无凭证返回 401", async () => {
    const app = createGateway({}, { GATEWAY_TOKEN: "secret" });
    const res = await request(app).get("/health");
    expect(res.status).toBe(401);
  });

  it("携带正确 token 放行", async () => {
    const app = createGateway({}, { GATEWAY_TOKEN: "secret" });
    const res = await request(app).get("/health").set("X-Access-Token", "secret");
    expect(res.status).toBe(200);
  });

  it("将请求代理到目标服务", async () => {
    const dummy = express();
    dummy.get("/dummy", (_req, res) => res.json({ ok: true }));
    const server = dummy.listen(0);
    const port = (server.address() as AddressInfo).port;
    try {
      const app = createGateway({ dummy: { web: port } }, {});
      const res = await request(app).get("/dummy");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    } finally {
      server.close();
    }
  });
});
