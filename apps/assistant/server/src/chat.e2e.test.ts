import { join } from "node:path";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { runMigrations } from "@mt/db";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool, scholarPool } from "./db";
import { pseudoVector } from "./llm";

const SCHOLAR_TEST_URL = "postgres://postgres:postgres@127.0.0.1:5432/scholar_assistant_e2e";

let app: INestApplication;
let available = false;

async function seedEntry(title: string, content: string, scoped: boolean) {
  const vec = pseudoVector(title + "\n" + content);
  await scholarPool().query(
    "INSERT INTO entries (source, source_ref, title, content, assistant_scope, embedding) VALUES ('manual', NULL, $1, $2, $3, $4::vector)",
    [title, content, scoped, "[" + vec.join(",") + "]"]
  );
}

beforeAll(async () => {
  try {
    process.env.MT_LLM_STUB = "1";
    process.env.SCHOLAR_DATABASE_URL = SCHOLAR_TEST_URL;
    await ensureDatabase();
    await migrate();
    await ensureDatabase(SCHOLAR_TEST_URL);
    await runMigrations(scholarPool(), join(__dirname, "..", "..", "..", "scholar", "server", "migrations"));
    available = true;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/assistant");
    await app.init();
  } catch (err) {
    console.warn("[chat.e2e] 数据库不可用，跳过: " + String(err));
    available = false;
  }
}, 60000);

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(async () => {
  if (!available) return;
  await pool.query("TRUNCATE conversations, messages");
  await scholarPool().query("TRUNCATE entries CASCADE");
});

describe("chat", () => {
  it("闲聊意图礼貌兜底并自动建会话", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "你好" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("chitchat_reject");
    expect(res.body.reply).toContain("助手");
    expect(res.body.sessionId).toBeTruthy();
    const rows = await pool.query("SELECT role FROM messages ORDER BY created_at");
    expect(rows.rows.map((r) => r.role)).toEqual(["user", "assistant"]);
  });

  it("product_inquiry 只检索圈定条目并带引用", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await seedEntry("苹果公司发布新手机", "苹果秋季发布会内容", true);
    await seedEntry("苹果供应链分析", "苹果供应链相关分析", false);
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "苹果公司有什么新动态" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("product_inquiry");
    expect(res.body.reply.length).toBeGreaterThan(0);
    expect(res.body.citations.length).toBeGreaterThanOrEqual(1);
    const titles = res.body.citations.map((c: { title: string }) => c.title);
    expect(titles.some((t: string) => t.includes("苹果公司发布新手机"))).toBe(true);
    expect(titles.some((t: string) => t.includes("苹果供应链分析"))).toBe(false);
  });

  it("product_inquiry 无圈定内容时诚实回答未找到", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "量子计算有什么进展" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("product_inquiry");
    expect(res.body.reply).toContain("未找到");
    expect(res.body.citations).toEqual([]);
  });

  it("data_query 未配置时优雅降级", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "查询一下销售数据" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("data_query");
    expect(res.body.reply).toContain("配置");
  });

  it("sessionId 复用同一会话追加消息", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const first = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "你好" });
    const second = await request(app.getHttpServer()).post("/api/assistant/chat").send({ sessionId: first.body.sessionId, message: "我们的产品有哪些功能" });
    expect(second.status).toBe(201);
    expect(second.body.sessionId).toBe(first.body.sessionId);
    const rows = await pool.query("SELECT role FROM messages ORDER BY created_at");
    expect(rows.rows).toHaveLength(4);
  });

  it("message 缺失返回 400", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({});
    expect(res.status).toBe(400);
  });
});
