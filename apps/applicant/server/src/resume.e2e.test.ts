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
    await pool.query("DELETE FROM resumes WHERE name = 'E2E简历'");
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

describe("resumes", () => {
  it("无 ClawCV Key 时 analyze 走本地降级并保存", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    delete process.env.CLAWCV_API_KEY;
    process.env.MT_LLM_STUB = "1";
    const created = await request(app.getHttpServer()).post("/api/applicant/resumes").send({ name: "E2E简历", contentText: "三年后端经验，熟悉 Java 微服务。" });
    const res = await request(app.getHttpServer()).post("/api/applicant/resumes/" + created.body.id + "/analyze");
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(res.body.via).toBe("local");
    expect(res.body).toHaveProperty("score");
  });

  it("无 Key 时 match 走本地降级", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    delete process.env.CLAWCV_API_KEY;
    process.env.MT_LLM_STUB = "1";
    const pos = await request(app.getHttpServer()).post("/api/applicant/positions").send({ company: "匹配测试公司", title: "后端", jdRaw: "要求熟悉 Java" });
    const created = await request(app.getHttpServer()).post("/api/applicant/resumes").send({ name: "E2E简历2", contentText: "熟悉 Java" });
    const res = await request(app.getHttpServer()).post("/api/applicant/resumes/" + created.body.id + "/match/" + pos.body.id);
    delete process.env.MT_LLM_STUB;
    expect(res.status).toBe(201);
    expect(res.body.via).toBe("local");
    expect(typeof res.body.match_score).toBe("number");
  });

  it("quota 未配置时返回 configured:false", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    delete process.env.CLAWCV_API_KEY;
    const res = await request(app.getHttpServer()).get("/api/applicant/meta/quota");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
  });
});
