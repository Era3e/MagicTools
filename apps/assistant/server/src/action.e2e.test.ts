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
    await ensureDatabase();
    await migrate();
    available = true;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/assistant");
    await app.init();
  } catch (err) {
    console.warn("[action.e2e] 数据库不可用，跳过: " + String(err));
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

describe("process_execution", () => {
  it("创建需求动作经 chat 返回 actionResult", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "帮我创建一个需求：支持导出功能" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("process_execution");
    expect(res.body.actionResult.ok).toBe(true);
    expect(res.body.actionResult.action).toBe("create_requirement");
    const rows = await pool.query("SELECT intent FROM messages WHERE role = 'assistant'");
    expect(rows.rows[0].intent).toBe("process_execution");
  });

  it("触发采集动作返回 trigger_collect 回执", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "触发一次信息采集" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("process_execution");
    expect(res.body.actionResult.action).toBe("trigger_collect");
  });
});
