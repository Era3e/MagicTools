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
  } catch {
    available = false;
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
