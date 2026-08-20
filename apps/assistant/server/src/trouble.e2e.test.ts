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
    console.warn("[trouble.e2e] 数据库不可用，跳过: " + String(err));
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

describe("trouble_shooting", () => {
  it("chat 返回服务状态概览与排查建议", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "系统报错了怎么排查" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("trouble_shooting");
    expect(res.body.reply).toContain("服务状态");
    expect(res.body.reply).toContain("建议");
  }, 30000);

  it("服务挂了也能得到概览", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "服务挂了帮我看看" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("trouble_shooting");
    expect(res.body.reply).toContain("建议");
  }, 30000);
});
