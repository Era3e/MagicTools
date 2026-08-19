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
    await pool.query("DELETE FROM positions WHERE company = 'E2E测试公司'");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/applicant");
    await app.init();
  } catch {
    available = false;
  }
}, 20000);

afterAll(async () => {
  if (app) await app.close();
});

describe("positions", () => {
  it("创建并列出岗位", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer())
      .post("/api/applicant/positions")
      .send({ company: "E2E测试公司", title: "后端工程师" });
    expect(created.status).toBe(201);
    expect(created.body.company).toBe("E2E测试公司");

    const list = await request(app.getHttpServer()).get("/api/applicant/positions");
    expect(list.status).toBe(200);
    expect(list.body.some((p: { company: string }) => p.company === "E2E测试公司")).toBe(true);
  });

  it("状态流转到 applied", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/applicant/positions?status=waiting");
    const target = list.body.find((p: { company: string }) => p.company === "E2E测试公司");
    const patched = await request(app.getHttpServer())
      .patch("/api/applicant/positions/" + target.id)
      .send({ status: "applied" });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe("applied");
  });

  it("非法状态返回 400", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/applicant/positions");
    const target = list.body.find((p: { company: string }) => p.company === "E2E测试公司");
    const res = await request(app.getHttpServer())
      .patch("/api/applicant/positions/" + target.id)
      .send({ status: "not-a-status" });
    expect(res.status).toBe(400);
  });

  it("JD 文本解析返回结构化字段（stub）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.MT_LLM_STUB = "1";
    const res = await request(app.getHttpServer())
      .post("/api/applicant/positions/parse-jd")
      .send({ text: "某公司招聘后端工程师 JD 内容，要求熟悉 Java 微服务" });
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(res.body.company).toBeTruthy();
    expect(Array.isArray(res.body.requirements)).toBe(true);
  });

  it("JD 文本过短返回 400", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer())
      .post("/api/applicant/positions/parse-jd")
      .send({ text: "太短" });
    expect(res.status).toBe(400);
  });

  it("生成打招呼话术（stub）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/applicant/positions");
    const target = list.body.find((p: { company: string }) => p.company === "E2E测试公司");
    process.env.MT_LLM_STUB = "1";
    const res = await request(app.getHttpServer())
      .post("/api/applicant/positions/" + target.id + "/greeting");
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(typeof res.body.greeting).toBe("string");
    expect(res.body.greeting.length).toBeGreaterThan(0);
  });
});
