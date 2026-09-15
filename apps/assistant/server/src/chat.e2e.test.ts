// @database-integration: required by test:db
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";
import { ScholarClient, type ScholarSearchCandidate } from "./scholar.client";

let app: INestApplication;
let available = false;
let scholarHits: ScholarSearchCandidate[] = [];

function candidate(title: string, content: string): ScholarSearchCandidate {
  return {
    entryId: "00000000-0000-0000-0000-000000000001",
    source: "manual",
    title,
    category: "product",
    revisionId: "00000000-0000-0000-0000-000000000011",
    revisionNo: 1,
    sourceRevision: "test-commit",
    sourceUrl: "https://example.com/commit",
    productVersionId: "00000000-0000-0000-0000-000000000021",
    productVersion: "1.0.0",
    deploymentRef: "registry@sha256:test",
    chunkId: "00000000-0000-0000-0000-000000000031",
    chunkNo: 1,
    content,
    charStart: 0,
    charEnd: content.length,
    score: 0.98,
    candidateNo: 1,
    channels: ["fts", "vector"],
    requirementLinks: [],
  };
}

beforeAll(async () => {
  try {
    process.env.MT_LLM_STUB = "1";
    await ensureDatabase();
    await migrate();
    available = true;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ScholarClient)
      .useValue({ search: async () => scholarHits })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/assistant");
    await app.init();
  } catch (error) {
    // 关键数据库套件必须失败并保留原错误，不能把初始化异常变成跳过。
    throw error;
  }
}, 60000);

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(async () => {
  if (!available) return;
  await pool.query("TRUNCATE conversations, messages");
  scholarHits = [];
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
    scholarHits = [candidate("苹果公司发布新手机", "苹果秋季发布会内容")];
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "苹果公司有什么新动态" });
    expect(res.status).toBe(201);
    expect(res.body.intent).toBe("product_inquiry");
    expect(res.body.reply.length).toBeGreaterThan(0);
    expect(res.body.citations.length).toBeGreaterThanOrEqual(1);
    expect(res.body.citations.map((c: { title: string }) => c.title)).toEqual(["苹果公司发布新手机"]);
    expect(res.body.citations[0].evidence).toBe("苹果秋季发布会内容");
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
