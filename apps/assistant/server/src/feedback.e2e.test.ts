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
    console.warn("[feedback.e2e] 数据库不可用，跳过: " + String(err));
    available = false;
  }
}, 30000);

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(async () => {
  if (!available) return;
  await pool.query("TRUNCATE conversations, messages, feedback");
});

describe("complaint_feedback", () => {
  it("chat 收集反馈落库并礼貌确认", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "我要投诉，搜索功能不好用" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("complaint_feedback");
    expect(res.body.reply).toContain("收到");
    const rows = await pool.query("SELECT content FROM feedback");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].content).toBe("我要投诉，搜索功能不好用");
  });

  it("反馈列表与删除", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "给你一个反馈：界面不错" });
    const list = await request(app.getHttpServer()).get("/api/assistant/feedback");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    const del = await request(app.getHttpServer()).delete("/api/assistant/feedback/" + list.body[0].id);
    expect(del.status).toBe(200);
    const after = await request(app.getHttpServer()).get("/api/assistant/feedback");
    expect(after.body).toHaveLength(0);
  });

  it("不存在的反馈删除返回 404", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).delete("/api/assistant/feedback/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });
});
