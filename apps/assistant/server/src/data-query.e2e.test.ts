import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

let app: INestApplication;
let available = false;

beforeAll(async () => {
  try {
    process.env.MT_LLM_STUB = "1";
    await ensureDatabase();
    await migrate();
    available = true;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/assistant");
    await app.init();
  } catch (err) {
    console.warn("[data-query.e2e] 数据库不可用，跳过: " + String(err));
    available = false;
  }
}, 30000);

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(async () => {
  if (!available) return;
  await pool.query("TRUNCATE conversations, messages");
});

describe("data_query", () => {
  it("桩模式返回格式化数据", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.CYBERCLOUD_STUB = "1";
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "查询一下销售数据" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("data_query");
    expect(res.body.reply).toContain("12345");
  });

  it("未配置且非桩模式优雅降级", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const prev = process.env.CYBERCLOUD_STUB;
    delete process.env.CYBERCLOUD_STUB;
    try {
      const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "查询一下销售数据" });
      expect(res.status).toBe(201);
      expect(res.body.intent).toBe("data_query");
      expect(res.body.reply).toContain("配置");
    } finally {
      if (prev) process.env.CYBERCLOUD_STUB = prev;
    }
  });

  it("GET /api/assistant/meta/data-source-status 返回配置状态", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.CYBERCLOUD_STUB = "1";
    const res = await request(app.getHttpServer()).get("/api/assistant/meta/data-source-status");
    expect(res.status).toBe(200);
    expect(res.body.stub).toBe(true);
    expect(res.body.configured).toBe(false);
  });
});
