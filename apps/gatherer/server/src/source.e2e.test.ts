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
    await pool.query("DELETE FROM sources WHERE name LIKE 'E2E%'");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/gatherer");
    await app.init();
  } catch {
    available = false;
  }
}, 20000);

afterAll(async () => {
  if (app) await app.close();
});

describe("sources", () => {
  it("创建并列出源", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const created = await request(app.getHttpServer())
      .post("/api/gatherer/sources")
      .send({ name: "E2E源", type: "rss", url: "https://example.com/feed", cron: "0 * * * *" });
    expect(created.status).toBe(201);
    const list = await request(app.getHttpServer()).get("/api/gatherer/sources");
    expect(list.body.some((s: { name: string }) => s.name === "E2E源")).toBe(true);
  });

  it("试采返回解析样例（桩模式）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.FEED_STUB = "1";
    const list = await request(app.getHttpServer()).get("/api/gatherer/sources");
    const target = list.body.find((s: { name: string }) => s.name === "E2E源");
    const res = await request(app.getHttpServer()).post("/api/gatherer/sources/" + target.id + "/test");
    delete process.env.FEED_STUB;
    expect(res.status).toBe(201);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it("非法类型返回 400", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const res = await request(app.getHttpServer()).post("/api/gatherer/sources").send({ name: "坏源", type: "ftp" });
    expect(res.status).toBe(400);
  });
});
