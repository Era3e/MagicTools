// @database-integration: required by test:db
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
    await pool.query("DELETE FROM positions WHERE company = '复盘测试公司'");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/applicant");
    await app.init();
  } catch (error) {
    // 关键数据库套件必须失败并保留原错误，不能把初始化异常变成跳过。
    throw error;
  }
}, 20000);

afterAll(async () => {
  if (app) await app.close();
});

describe("interviews", () => {
  it("创建复盘并生成分析（stub 模式）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const pos = await request(app.getHttpServer()).post("/api/applicant/positions").send({ company: "复盘测试公司", title: "测试岗" });
    const created = await request(app.getHttpServer())
      .post("/api/applicant/positions/" + pos.body.id + "/interviews")
      .send({ round: 1, qaNotes: "问了一致性哈希。答得一般。", reflection: "需要复习分布式基础" });
    expect(created.status).toBe(201);

    process.env.MT_LLM_STUB = "1";
    const analyzed = await request(app.getHttpServer()).post("/api/applicant/interviews/" + created.body.id + "/analyze");
    delete process.env.MT_LLM_STUB;
    expect(analyzed.status).toBe(201);
    expect(analyzed.body.analysis).toBeTruthy();

    const exported = await request(app.getHttpServer()).get("/api/applicant/interviews/" + created.body.id + "/export.md");
    expect(exported.status).toBe(200);
    expect(exported.text).toContain("# 面试复盘");
  });
});

describe("interviews · 计划面试（D-15）", () => {
  it("创建计划面试 → 跨岗位列表 → 改期 → 标记完成", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const company = "日历E2E公司" + Date.now();
    const pos = await request(app.getHttpServer())
      .post("/api/applicant/positions")
      .send({ company, title: "计划面试岗" });
    const scheduledAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const created = await request(app.getHttpServer())
      .post("/api/applicant/positions/" + pos.body.id + "/interviews")
      .send({ round: 2, status: "scheduled", happenedAt: scheduledAt });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("scheduled");
    expect(created.body.happenedAt).toBe(scheduledAt);

    const all = await request(app.getHttpServer()).get("/api/applicant/interviews");
    expect(all.status).toBe(200);
    const mine = all.body.find((i: { company: string }) => i.company === company);
    expect(mine.company).toBe(company);
    expect(mine.title).toBe("计划面试岗");
    expect(mine.status).toBe("scheduled");

    const moved = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const patched = await request(app.getHttpServer())
      .patch("/api/applicant/interviews/" + mine.id)
      .send({ happenedAt: moved });
    expect(patched.status).toBe(200);
    expect(patched.body.happenedAt).toBe(moved);

    const done = await request(app.getHttpServer())
      .patch("/api/applicant/interviews/" + mine.id)
      .send({ status: "done" });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("done");
  });

  it("校验拒绝：done 缺 qaNotes / 非法 status / 空 PATCH body", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const company = "日历E2E公司" + Date.now();
    const pos = await request(app.getHttpServer())
      .post("/api/applicant/positions")
      .send({ company, title: "校验岗" });

    const noNotes = await request(app.getHttpServer())
      .post("/api/applicant/positions/" + pos.body.id + "/interviews")
      .send({ round: 1, status: "done" });
    expect(noNotes.status).toBe(400);

    const created = await request(app.getHttpServer())
      .post("/api/applicant/positions/" + pos.body.id + "/interviews")
      .send({ round: 1, status: "scheduled" });
    expect(created.status).toBe(201);

    const badPatch = await request(app.getHttpServer())
      .patch("/api/applicant/interviews/" + created.body.id)
      .send({ status: "paused" });
    expect(badPatch.status).toBe(400);

    const emptyPatch = await request(app.getHttpServer())
      .patch("/api/applicant/interviews/" + created.body.id)
      .send({});
    expect(emptyPatch.status).toBe(400);
  });
});
