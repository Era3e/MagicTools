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
    console.warn("[intent-log.e2e] 数据库不可用，跳过: " + String(err));
    available = false;
  }
}, 30000);

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(async () => {
  if (!available) return;
  await pool.query("TRUNCATE conversations, messages, intent_logs, feedback");
});

describe("intent_logs", () => {
  it("chat 分类后意图日志落库（domain/intent/confidence）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "帮我创建一个订单业务对象" });
    expect(res.status).toBe(201);
    expect(res.body.domain).toBe("cybercloud");
    expect(res.body.intent).toBe("data_query");
    expect(res.body.confidence).toBe(1);
    const rows = await pool.query("SELECT message, domain, intent, confidence::float AS confidence FROM intent_logs");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].domain).toBe("cybercloud");
    expect(rows.rows[0].intent).toBe("data_query");
    expect(rows.rows[0].confidence).toBe(1);
  });

  it("GET /api/assistant/intent-logs 列表与筛选", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "帮我创建一个需求：支持导出功能" });
    await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "你好" });
    const all = await request(app.getHttpServer()).get("/api/assistant/intent-logs");
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);
    const filtered = await request(app.getHttpServer()).get("/api/assistant/intent-logs?domain=chitchat");
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].intent).toBe("chitchat_reject");
  });

  it("POST /api/assistant/intent-logs/:id/correct 纠错回填", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "你好" });
    const list = await request(app.getHttpServer()).get("/api/assistant/intent-logs");
    const id = list.body[0].id;
    const res = await request(app.getHttpServer())
      .post("/api/assistant/intent-logs/" + id + "/correct")
      .send({ correctedIntent: "complaint_feedback" });
    expect(res.status).toBe(201);
    expect(res.body.correctedIntent).toBe("complaint_feedback");
    const rows = await pool.query("SELECT corrected_intent FROM intent_logs WHERE id = $1", [id]);
    expect(rows.rows[0].corrected_intent).toBe("complaint_feedback");
  });

  it("纠错不存在的日志返回 404", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer())
      .post("/api/assistant/intent-logs/00000000-0000-0000-0000-000000000000/correct")
      .send({ correctedIntent: "data_query" });
    expect(res.status).toBe(404);
  });
});
