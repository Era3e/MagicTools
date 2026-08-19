import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appendOutbox } from "@mt/db";
import { idempotencyKey } from "@mt/utils";
import { AppModule } from "./app.module";
import { ensureDatabase, investigatorPool, migrate, pool } from "./db";

let app: INestApplication;
let available = false;

beforeAll(async () => {
  try {
    await ensureDatabase();
    await migrate();
    available = true;
    await pool.query("DELETE FROM analysis_requests");
    // 清场：investigator 库的历史 push 事件（跨测试残留）
    await investigatorPool.query("DELETE FROM outbox WHERE event = 'researcher.response.push'");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/assessor");
    await app.init();
  } catch {
    available = false;
  }
}, 20000);

afterAll(async () => {
  if (app) await app.close();
});

describe("inbox", () => {
  it("poll 消费 investigator 事件并聚合为分析请求（幂等）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const e1 = idempotencyKey("assessor-e2e");
    const e2 = idempotencyKey("assessor-e2e");
    await appendOutbox(investigatorPool, {
      id: e1, event: "researcher.response.push", source: "investigator",
      payload: { surveyId: "s1", surveyName: "E2E调研", responseId: "r1", structured: { requirements: ["需求一"] }, sentiment: "neutral", priority: "P1" },
      occurredAt: new Date().toISOString(),
    });
    await appendOutbox(investigatorPool, {
      id: e2, event: "researcher.response.push", source: "investigator",
      payload: { surveyId: "s1", surveyName: "E2E调研", responseId: "r2", structured: { requirements: ["需求二"] }, sentiment: "positive", priority: "P2" },
      occurredAt: new Date().toISOString(),
    });
    const res = await request(app.getHttpServer()).post("/api/assessor/inbox/poll");
    expect(res.status).toBe(201);
    expect(res.body.consumed).toBe(2);
    expect(res.body.created).toBe(1);

    const list = await request(app.getHttpServer()).get("/api/assessor/requests");
    expect(list.body.length).toBe(1);
    expect(list.body[0].surveyName).toBe("E2E调研");

    const res2 = await request(app.getHttpServer()).post("/api/assessor/inbox/poll");
    expect(res2.body.created).toBe(0);
  });

  it("更新仓库地址自动拉取上下文（桩模式）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.GITHUB_STUB = "1";
    const list = await request(app.getHttpServer()).get("/api/assessor/requests");
    const target = list.body[0];
    const res = await request(app.getHttpServer())
      .patch("/api/assessor/requests/" + target.id)
      .send({ repoUrl: "Era3e/MagicTools" });
    delete process.env.GITHUB_STUB;
    expect(res.status).toBe(200);
    expect(res.body.repoUrl).toBe("Era3e/MagicTools");
    expect(res.body.repoContext).toHaveProperty("readme");
  });

  it("generate 生成分析方案并置 draft（桩）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.MT_LLM_STUB = "1";
    const list = await request(app.getHttpServer()).get("/api/assessor/requests");
    const target = list.body[0];
    const res = await request(app.getHttpServer()).post("/api/assessor/requests/" + target.id + "/generate");
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(res.body.analysisMd).toContain("需求分析");
    expect(res.body.designMd).toContain("设计方案");
    expect(res.body.status).toBe("draft");
  });

  it("review 通过后 push 落 requirement.created", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/assessor/requests");
    const target = list.body[0];
    const approved = await request(app.getHttpServer())
      .post("/api/assessor/requests/" + target.id + "/review")
      .send({ approve: true, comment: "方案可行" });
    expect(approved.status).toBe(201);
    expect(approved.body.status).toBe("approved");

    const pushed = await request(app.getHttpServer()).post("/api/assessor/requests/" + target.id + "/push");
    expect(pushed.status).toBe(201);
    expect(pushed.body.pushed).toBe(true);
    const rows = await pool.query("SELECT * FROM outbox WHERE event = 'requirement.created'");
    expect(rows.rowCount).toBeGreaterThanOrEqual(1);
  });

  it("驳回必须带意见", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer()).post("/api/assessor/inbox/poll");
    expect(created.status).toBe(201);
    const res = await request(app.getHttpServer())
      .post("/api/assessor/inbox/poll")
      .send({});
    expect(res.status).toBe(201);
    // 取一个请求尝试无意见驳回
    const list = await request(app.getHttpServer()).get("/api/assessor/requests");
    const target = list.body[0];
    const rejected = await request(app.getHttpServer())
      .post("/api/assessor/requests/" + target.id + "/review")
      .send({ approve: false, comment: "" });
    expect(rejected.status).toBe(400);
  });
});
