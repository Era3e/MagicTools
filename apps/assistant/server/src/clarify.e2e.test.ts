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
    process.env.ACTION_STUB = "1";
    process.env.CLARIFY_STUB_CONFIDENCE = "0.3";
    await ensureDatabase();
    await migrate();
    available = true;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/assistant");
    await app.init();
  } catch (err) {
    console.warn("[clarify.e2e] 数据库不可用，跳过: " + String(err));
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

describe("clarify", () => {
  it("低置信度返回澄清反问而非直接执行", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "帮我创建一个需求：支持导出功能" });
    expect(res.status).toBe(201);
    expect(res.body.clarifying).toBe(true);
    expect(res.body.confidence).toBe(0.3);
    expect(res.body.reply).toContain("请选择");
    expect(res.body.clarifyOptions.length).toBeGreaterThanOrEqual(2);
    expect(res.body.actionResult).toEqual({});
    const logs = await pool.query("SELECT confidence::float AS confidence, corrected_intent FROM intent_logs");
    expect(logs.rows).toHaveLength(1);
    expect(logs.rows[0].confidence).toBe(0.3);
    expect(logs.rows[0].corrected_intent).toBeNull();
  });

  it("用户按序号确认后执行对应分支并回填纠错", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const first = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "帮我创建一个需求：支持导出功能" });
    const sid = first.body.sessionId;
    const confirm = await request(app.getHttpServer()).post("/api/assistant/chat").send({ sessionId: sid, message: "1" });
    expect(confirm.status).toBe(201);
    expect(confirm.body.clarifying).toBe(false);
    expect(confirm.body.intent).toBe("process_execution");
    expect(confirm.body.actionResult.ok).toBe(true);
    const logs = await pool.query("SELECT corrected_intent FROM intent_logs ORDER BY created_at");
    expect(logs.rows[0].corrected_intent).toBe("process_execution");
  });

  it("用户选择备选意图同样生效", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const first = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "帮我创建一个需求：支持导出功能" });
    const opts = first.body.clarifyOptions;
    const alt = opts.find((o: { intent: string }) => o.intent !== "process_execution");
    const confirm = await request(app.getHttpServer())
      .post("/api/assistant/chat")
      .send({ sessionId: first.body.sessionId, message: alt.intent });
    expect(confirm.status).toBe(201);
    expect(confirm.body.intent).toBe(alt.intent);
    const logs = await pool.query("SELECT corrected_intent FROM intent_logs ORDER BY created_at");
    expect(logs.rows[0].corrected_intent).toBe(alt.intent);
  });

  it("高置信度（默认）不触发澄清", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const prev = process.env.CLARIFY_STUB_CONFIDENCE;
    delete process.env.CLARIFY_STUB_CONFIDENCE;
    try {
      const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "帮我创建一个需求：支持导出功能" });
      expect(res.status).toBe(201);
      expect(res.body.clarifying).toBe(false);
      expect(res.body.intent).toBe("process_execution");
      expect(res.body.actionResult.ok).toBe(true);
    } finally {
      if (prev) process.env.CLARIFY_STUB_CONFIDENCE = prev;
    }
  });
});
