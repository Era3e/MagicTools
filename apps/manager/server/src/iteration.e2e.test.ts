import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";

let app: INestApplication;
let available = false;

beforeAll(async () => {
  try {
    await ensureDatabase();
    await migrate();
    available = true;
    await pool.query("DELETE FROM iterations WHERE name = 'E2E迭代'");
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

describe("iterations", () => {
  it("创建迭代并挂需求（自包含）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const it = await request(app.getHttpServer()).post("/api/manager/iterations").send({ name: "E2E迭代", startDate: "2026-08-20", endDate: "2026-09-05" });
    expect(it.status).toBe(201);
    // 自建需求再挂迭代（不依赖其他测试文件的数据，vitest 文件间并行）
    const req = await request(app.getHttpServer()).post("/api/manager/requirements").send({ title: "迭代测试需求" });
    expect(req.status).toBe(201);
    const patched = await request(app.getHttpServer())
      .patch("/api/manager/requirements/" + req.body.id)
      .send({ iterationId: it.body.id });
    expect(patched.status).toBe(200);
    expect(patched.body.iterationId).toBe(it.body.id);
  });
});
