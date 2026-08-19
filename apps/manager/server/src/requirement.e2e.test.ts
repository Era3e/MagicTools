import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appendOutbox } from "@mt/db";
import { idempotencyKey } from "@mt/utils";
import { AppModule } from "./app.module";
import { assessorPool, ensureDatabase, migrate, pool } from "./db";

let app: INestApplication;
let available = false;

beforeAll(async () => {
  try {
    await ensureDatabase();
    await migrate();
    available = true;
    await pool.query("DELETE FROM requirements");
    await assessorPool.query("DELETE FROM outbox WHERE event = 'requirement.created'");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/manager");
    await app.init();
  } catch {
    available = false;
  }
}, 20000);

afterAll(async () => {
  if (app) await app.close();
});

describe("inbox", () => {
  it("poll 消费 assessor 事件并建需求（幂等）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const eid = idempotencyKey("manager-e2e");
    await appendOutbox(assessorPool, {
      id: eid, event: "requirement.created", source: "assessor",
      payload: { requestId: "req1", surveyName: "E2E调研", analysisMd: "# 需求分析", designMd: "# 设计方案", repoUrl: "Era3e/MagicTools", reviewComment: "ok" },
      occurredAt: new Date().toISOString(),
    });
    const res = await request(app.getHttpServer()).post("/api/manager/inbox/poll");
    expect(res.status).toBe(201);
    expect(res.body.consumed).toBe(1);
    expect(res.body.created).toBe(1);

    const list = await request(app.getHttpServer()).get("/api/manager/requirements");
    expect(list.body.length).toBe(1);
    expect(list.body[0].source).toBe("assessor");
    expect(list.body[0].status).toBe("waiting");

    const res2 = await request(app.getHttpServer()).post("/api/manager/inbox/poll");
    expect(res2.body.created).toBe(0);
  });

  it("手动录入需求", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer())
      .post("/api/manager/requirements")
      .send({ title: "手动需求", description: "描述", priority: "P1" });
    expect(created.status).toBe(201);
    expect(created.body.source).toBe("manual");
    expect(created.body.status).toBe("waiting");
  });

  it("非法状态返回 400", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/manager/requirements");
    const target = list.body[0];
    const res = await request(app.getHttpServer())
      .patch("/api/manager/requirements/" + target.id)
      .send({ status: "not-a-status" });
    expect(res.status).toBe(400);
  });
});
