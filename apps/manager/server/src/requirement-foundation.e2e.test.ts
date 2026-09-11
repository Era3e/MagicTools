// @database-integration: required by test:db
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureDatabase, migrate, pool } from "./db";
import { RequirementController } from "./requirement.controller";
import { RequirementService } from "./requirement.service";
import { WebhookController } from "./webhook.controller";
import { randomUUID } from "node:crypto";

let app: INestApplication;

beforeAll(async () => {
  await ensureDatabase();
  await migrate();
  const module = await Test.createTestingModule({
    controllers: [RequirementController, WebhookController],
    providers: [RequirementService],
  }).compile();
  app = module.createNestApplication();
  app.setGlobalPrefix("api/manager");
  await app.init();
}, 20000);

afterAll(async () => {
  if (app) await app.close();
  await pool.end();
});

describe("需求变更契约", () => {
  it("重复的同状态 PR 事件不改变修订，不使人工编辑失效", async () => {
    const prUrl = "https://github.com/Era3e/MagicTools/pull/" + Date.now();
    const created = await request(app.getHttpServer()).post("/api/manager/requirements")
      .send({ title: "PR 同状态保护" }).expect(201);
    await request(app.getHttpServer()).patch("/api/manager/requirements/" + created.body.id).send({ prUrl }).expect(200);
    const priorStub = process.env.GITHUB_STUB;
    process.env.GITHUB_STUB = "1";
    try {
      const payload = { action: "closed", pull_request: { html_url: prUrl, state: "closed", merged: true } };
      await request(app.getHttpServer()).post("/api/manager/webhook/github")
        .set("x-github-event", "pull_request").set("x-github-delivery", randomUUID()).send(payload).expect(200);
      const first = await request(app.getHttpServer()).get("/api/manager/requirements/" + created.body.id).expect(200);
      const duplicate = await request(app.getHttpServer()).post("/api/manager/webhook/github")
        .set("x-github-event", "pull_request").set("x-github-delivery", randomUUID()).send(payload).expect(200);
      expect(duplicate.body.action).toBe("skipped");
      const second = await request(app.getHttpServer()).get("/api/manager/requirements/" + created.body.id).expect(200);
      expect(second.body.revision).toBe(first.body.revision);
      await request(app.getHttpServer()).patch("/api/manager/requirements/" + created.body.id)
        .send({ expectedRevision: first.body.revision, description: "保留人工编辑" }).expect(200);
    } finally {
      if (priorStub === undefined) delete process.env.GITHUB_STUB;
      else process.env.GITHUB_STUB = priorStub;
    }
  });

  it("同一修订并发修改时仅一份成功，另一份返回冲突", async () => {
    const created = await request(app.getHttpServer()).post("/api/manager/requirements")
      .send({ title: "并发版本测试" }).expect(201);
    expect(created.body.revision).toBe(1);
    const responses = await Promise.all(["版本甲", "版本乙"].map((description) =>
      request(app.getHttpServer()).patch("/api/manager/requirements/" + created.body.id)
        .send({ description, expectedRevision: 1 })
    ));
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const saved = await request(app.getHttpServer()).get("/api/manager/requirements/" + created.body.id).expect(200);
    expect(saved.body.revision).toBe(2);
    expect(saved.body.description).toBe(responses.find((r) => r.status === 200)?.body.description);
  });

  it("拒绝从待分析直接标记完成，并保持其他字段不变", async () => {
    const created = await request(app.getHttpServer()).post("/api/manager/requirements")
      .send({ title: "状态边界测试", priority: "P2" }).expect(201);
    await request(app.getHttpServer()).patch("/api/manager/requirements/" + created.body.id)
      .send({ status: "done", priority: "P0" }).expect(400);
    const saved = await request(app.getHttpServer()).get("/api/manager/requirements/" + created.body.id).expect(200);
    expect(saved.body.status).toBe("waiting");
    expect(saved.body.priority).toBe("P2");
    expect(saved.body.timeline).toEqual([]);
  });

  it("一次更新同时保存状态和描述", async () => {
    const created = await request(app.getHttpServer()).post("/api/manager/requirements")
      .send({ title: "原子更新测试", description: "修改前" }).expect(201);
    const updated = await request(app.getHttpServer()).patch("/api/manager/requirements/" + created.body.id)
      .send({ status: "designing", description: "修改后的完整描述" }).expect(200);
    expect(updated.body.status).toBe("designing");
    expect(updated.body.description).toBe("修改后的完整描述");
    const saved = await request(app.getHttpServer()).get("/api/manager/requirements/" + created.body.id).expect(200);
    expect(saved.body.description).toBe("修改后的完整描述");
    expect(saved.body.timeline).toHaveLength(1);
  });
});
