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

function candidate(no: number, title: string, content: string): ScholarSearchCandidate {
  return {
    entryId: "00000000-0000-0000-0000-00000000000" + no,
    source: "manual",
    title,
    category: "product",
    revisionId: "00000000-0000-0000-0000-00000000010" + no,
    revisionNo: 1,
    sourceRevision: "test-commit",
    sourceUrl: "https://example.com/commit",
    productVersionId: "00000000-0000-0000-0000-000000000021",
    productVersion: "1.0.0",
    deploymentRef: "registry@sha256:test",
    chunkId: "00000000-0000-0000-0000-00000000020" + no,
    chunkNo: 1,
    content,
    charStart: 0,
    charEnd: content.length,
    score: 0.98,
    candidateNo: no,
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
      .useValue({
        search: async (question: string) => {
          if (question.includes("供应链")) return [candidate(2, "苹果供应链分析", "苹果供应链相关分析")];
          if (question.includes("苹果公司")) return [candidate(1, "苹果公司发布新手机", "苹果秋季发布会内容")];
          return [];
        },
      })
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
});

describe("multi-turn", () => {
  it("会话列表/历史消息/删除完整闭环", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const first = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "你好" });
    const sid = first.body.sessionId;
    await request(app.getHttpServer()).post("/api/assistant/chat").send({ sessionId: sid, message: "我们的产品有哪些功能" });

    const list = await request(app.getHttpServer()).get("/api/assistant/conversations");
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].id).toBe(sid);
    expect(list.body[0].title).toBe("你好");

    const msgs = await request(app.getHttpServer()).get("/api/assistant/conversations/" + sid + "/messages");
    expect(msgs.status).toBe(200);
    expect(msgs.body).toHaveLength(4);
    expect(msgs.body.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);

    const del = await request(app.getHttpServer()).delete("/api/assistant/conversations/" + sid);
    expect(del.status).toBe(200);
    const after = await request(app.getHttpServer()).get("/api/assistant/conversations");
    expect(after.body).toHaveLength(0);
    const gone = await request(app.getHttpServer()).get("/api/assistant/conversations/" + sid + "/messages");
    expect(gone.status).toBe(404);
  });

  it("指代消解：第二问结合历史定位圈定条目", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const first = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "苹果公司有什么新动态" });
    expect(first.body.citations.some((c: { title: string }) => c.title.includes("苹果公司发布新手机"))).toBe(true);
    const second = await request(app.getHttpServer()).post("/api/assistant/chat").send({ sessionId: first.body.sessionId, message: "那它的供应链情况呢" });
    expect(second.status).toBe(201);
    expect(second.body.intent).toBe("product_inquiry");
    const titles = second.body.citations.map((c: { title: string }) => c.title);
    expect(titles.some((t: string) => t.includes("苹果供应链分析"))).toBe(true);
    expect(titles.some((t: string) => t.includes("香蕉"))).toBe(false);
  });

  it("指代消解依赖历史注入检索词（回归）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const first = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "苹果公司有什么新动态" });
    const second = await request(app.getHttpServer()).post("/api/assistant/chat").send({ sessionId: first.body.sessionId, message: "那它有什么动作呢" });
    expect(second.status).toBe(201);
    const titles = second.body.citations.map((c: { title: string }) => c.title);
    expect(titles.some((t: string) => t.includes("苹果公司发布新手机"))).toBe(true);
  });

  it("长历史不会超过公共检索500字符上限", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const longHistory = "历史背景。".repeat(120) + "关键词是苹果供应链";
    const first = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: longHistory });
    const second = await request(app.getHttpServer())
      .post("/api/assistant/chat")
      .send({ sessionId: first.body.sessionId, message: "那它的供应链情况呢" });
    expect(second.status).toBe(201);
    expect(second.body.citations.map((c: { title: string }) => c.title)).toContain("苹果供应链分析");
  });

  it("data_query 意图随历史延续", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.CYBERCLOUD_STUB = "1";
    const first = await request(app.getHttpServer()).post("/api/assistant/chat").send({ message: "查询一下销售数据" });
    expect(first.body.intent).toBe("data_query");
    const second = await request(app.getHttpServer()).post("/api/assistant/chat").send({ sessionId: first.body.sessionId, message: "那第二个呢" });
    expect(second.status).toBe(201);
    expect(second.body.intent).toBe("data_query");
    expect(second.body.reply).toContain("12345");
  });

  it("不存在的会话返回 404", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/assistant/chat").send({ sessionId: "00000000-0000-0000-0000-000000000000", message: "你好" });
    expect(res.status).toBe(404);
  });
});
