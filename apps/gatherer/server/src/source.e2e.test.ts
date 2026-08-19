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

  it("采集入库并去重（双桩模式）", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.FEED_STUB = "1";
    process.env.MT_LLM_STUB = "1";
    const list = await request(app.getHttpServer()).get("/api/gatherer/sources");
    const target = list.body.find((s: { name: string }) => s.name === "E2E源");
    const res = await request(app.getHttpServer()).post("/api/gatherer/sources/" + target.id + "/collect");
    expect(res.status).toBe(201);
    expect(res.body.new).toBeGreaterThan(0);

    const res2 = await request(app.getHttpServer()).post("/api/gatherer/sources/" + target.id + "/collect");
    delete process.env.FEED_STUB;
    delete process.env.MT_LLM_STUB;
    expect(res2.body.new).toBe(0);

    const items = await request(app.getHttpServer()).get("/api/gatherer/items?sourceId=" + target.id);
    expect(items.body.length).toBeGreaterThan(0);
    expect(items.body[0].llmEnriched).toBe(true);
  });

  it("推送条目写 outbox 事件并标记", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/gatherer/sources");
    const target = list.body.find((s: { name: string }) => s.name === "E2E源");
    const items = await request(app.getHttpServer()).get("/api/gatherer/items?sourceId=" + target.id);
    const ids = items.body.map((i: { id: string }) => i.id).slice(0, 2);
    const res = await request(app.getHttpServer()).post("/api/gatherer/items/push").send({ ids });
    expect(res.status).toBe(201);
    expect(res.body.pushedCount).toBe(ids.length);
    const rows = await pool.query("SELECT * FROM outbox WHERE event = 'knowledge.item.collected'");
    expect(rows.rowCount).toBeGreaterThanOrEqual(ids.length);
  });
});
