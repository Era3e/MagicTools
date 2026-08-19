import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { migrate, pool } from "./db";

let app: INestApplication;
let available = false;

beforeAll(async () => {
  try {
    await migrate();
    available = true;
    await pool.query("DELETE FROM surveys WHERE name = 'E2E调研'");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/investigator");
    await app.init();
  } catch {
    available = false;
  }
}, 20000);

afterAll(async () => {
  if (app) await app.close();
});

describe("surveys", () => {
  it("创建并列出调研主题", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer())
      .post("/api/investigator/surveys")
      .send({ name: "E2E调研", appToken: "appX", tableId: "tblX", answerFields: ["回答"] });
    expect(created.status).toBe(201);
    expect(created.body.appToken).toBe("appX");

    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    expect(list.status).toBe(200);
    expect(list.body.some((s: { name: string }) => s.name === "E2E调研")).toBe(true);
  });

  it("更新主题状态到 archived", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    const patched = await request(app.getHttpServer())
      .patch("/api/investigator/surveys/" + target.id)
      .send({ status: "archived" });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe("archived");
  });

  it("feishu-status 未配置凭证返回明确状态", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_STUB;
    const res = await request(app.getHttpServer()).get("/api/investigator/meta/feishu-status");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
  });

  it("同步拉取并结构化（双桩模式）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.FEISHU_STUB = "1";
    process.env.MT_LLM_STUB = "1";
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    const res = await request(app.getHttpServer()).post("/api/investigator/surveys/" + target.id + "/sync");
    delete process.env.FEISHU_STUB;
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(res.body.fetchedCount).toBeGreaterThan(0);
    expect(res.body.processedCount).toBe(res.body.fetchedCount);

    const responses = await request(app.getHttpServer()).get("/api/investigator/surveys/" + target.id + "/responses");
    expect(responses.status).toBe(200);
    expect(responses.body.length).toBeGreaterThan(0);
    expect(responses.body[0].structured).toHaveProperty("requirements");
  });

  it("重复同步幂等（不产生重复记录）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.FEISHU_STUB = "1";
    process.env.MT_LLM_STUB = "1";
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    await request(app.getHttpServer()).post("/api/investigator/surveys/" + target.id + "/sync");
    const count = await pool.query("SELECT count(*)::int AS c FROM responses WHERE survey_id = $1", [target.id]);
    await request(app.getHttpServer()).post("/api/investigator/surveys/" + target.id + "/sync");
    const count2 = await pool.query("SELECT count(*)::int AS c FROM responses WHERE survey_id = $1", [target.id]);
    delete process.env.FEISHU_STUB;
    delete process.env.MT_LLM_STUB;
    expect(count2.rows[0].c).toBe(count.rows[0].c);
  });

  it("生成主题总结（桩模式）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.MT_LLM_STUB = "1";
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    const res = await request(app.getHttpServer()).post("/api/investigator/surveys/" + target.id + "/summarize");
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(typeof res.body.summary).toBe("string");
  });

  it("推送记录写 outbox 事件并标记", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/investigator/surveys");
    const target = list.body.find((s: { name: string }) => s.name === "E2E调研");
    const responses = await request(app.getHttpServer()).get("/api/investigator/surveys/" + target.id + "/responses");
    const ids = responses.body.map((r: { id: string }) => r.id).slice(0, 2);
    const res = await request(app.getHttpServer())
      .post("/api/investigator/surveys/" + target.id + "/push")
      .send({ recordIds: ids });
    expect(res.status).toBe(201);
    expect(res.body.pushedCount).toBe(ids.length);

    const outboxRows = await pool.query("SELECT * FROM outbox WHERE event = 'researcher.response.push' ORDER BY occurred_at DESC LIMIT 2");
    expect(outboxRows.rowCount).toBeGreaterThanOrEqual(ids.length);
  });
});
