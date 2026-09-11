// @database-integration: required by test:db
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { HealthController } from "./health.controller";
import { migrate, pool } from "./db";

let app: INestApplication;
beforeAll(async () => {
  await migrate();
  const module = await Test.createTestingModule({ controllers: [HealthController] }).compile();
  app = module.createNestApplication(); app.setGlobalPrefix("api/manager"); await app.init();
});
afterAll(async () => { if (app) await app.close(); await pool.end(); });

it("就绪接口验证迁移账本，缺少迁移时返回503但存活接口保持可用", async () => {
  await request(app.getHttpServer()).get("/api/manager/health/ready").expect(200);
  const latest = await pool.query<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1");
  const name = latest.rows[0].name;
  await pool.query("DELETE FROM schema_migrations WHERE name=$1", [name]);
  try {
    const response = await request(app.getHttpServer()).get("/api/manager/health/ready").expect(503);
    expect(response.body.reason).toBe("migrations-pending");
    await request(app.getHttpServer()).get("/api/manager/health").expect(200);
  } finally { await pool.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]); }
});
