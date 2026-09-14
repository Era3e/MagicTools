// @database-integration: required by test:db
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appendOutbox } from "@mt/db";
import { idempotencyKey } from "@mt/utils";
import { AppModule } from "./app.module";
import { ensureDatabase, migrate, pool } from "./db";
import { stopScheduler } from "./scheduler";

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
  } catch (error) {
    // 关键数据库套件必须失败并保留原错误，不能把初始化异常变成跳过。
    throw error;
  }
}, 20000);

afterAll(async () => {
  stopScheduler();
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

  it("autoPush 只推送新增条目、重放不追加事件且可补推中断条目", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    process.env.FEED_STUB = "1";
    process.env.MT_LLM_STUB = "1";
    await pool.query("DELETE FROM sources WHERE name = $1", ["E2E自动推送源"]);
    await pool.query("DELETE FROM outbox WHERE event = 'knowledge.item.collected'");
    const created = await request(app.getHttpServer())
      .post("/api/gatherer/sources")
      .send({ name: "E2E自动推送源", type: "rss", url: "https://example.com/auto", cron: "0 0 31 2 *", options: { autoPush: true } });
    expect(created.status).toBe(201);

    const collected = await request(app.getHttpServer()).post("/api/gatherer/sources/" + created.body.id + "/collect");
    expect(collected.status).toBe(201);
    expect(collected.body.new).toBeGreaterThan(0);
    expect(collected.body.pushedCount).toBe(collected.body.new);

    const items = await request(app.getHttpServer()).get("/api/gatherer/items?sourceId=" + created.body.id);
    expect(items.body.length).toBeGreaterThan(0);
    expect(items.body.every((item: { pushedAt: string | null }) => item.pushedAt)).toBe(true);
    const before = await pool.query("SELECT id FROM outbox WHERE event = 'knowledge.item.collected' ORDER BY id");
    expect(before.rowCount).toBe(items.body.length);

    const collectedAgain = await request(app.getHttpServer()).post("/api/gatherer/sources/" + created.body.id + "/collect");
    delete process.env.FEED_STUB;
    delete process.env.MT_LLM_STUB;
    expect(collectedAgain.status).toBe(201);
    expect(collectedAgain.body.new).toBe(0);
    expect(collectedAgain.body.pushedCount).toBe(0);
    const afterRepeat = await pool.query("SELECT id FROM outbox WHERE event = 'knowledge.item.collected' ORDER BY id");
    expect(afterRepeat.rows.map((row: { id: string }) => row.id)).toEqual(before.rows.map((row: { id: string }) => row.id));

    const ids = items.body.map((item: { id: string }) => item.id);
    const pushedAgain = await request(app.getHttpServer()).post("/api/gatherer/items/push").send({ ids });
    expect(pushedAgain.status).toBe(201);
    expect(pushedAgain.body.pushedCount).toBe(0);
    expect(pushedAgain.body.skippedCount).toBe(ids.length);
    const afterPushAgain = await pool.query("SELECT id FROM outbox WHERE event = 'knowledge.item.collected' ORDER BY id");
    expect(afterPushAgain.rows.map((row: { id: string }) => row.id)).toEqual(before.rows.map((row: { id: string }) => row.id));

    await pool.query("UPDATE items SET pushed_at = NULL WHERE source_id = $1", [created.body.id]);
    await pool.query("DELETE FROM outbox WHERE event = 'knowledge.item.collected'");
    process.env.FEED_STUB = "1";
    process.env.MT_LLM_STUB = "1";
    const recovered = await request(app.getHttpServer()).post("/api/gatherer/sources/" + created.body.id + "/collect");
    delete process.env.FEED_STUB;
    delete process.env.MT_LLM_STUB;
    expect(recovered.status).toBe(201);
    expect(recovered.body.new).toBe(0);
    expect(recovered.body.pushedCount).toBe(items.body.length);
    const recoveredEvents = await pool.query("SELECT id FROM outbox WHERE event = 'knowledge.item.collected' ORDER BY id");
    expect(recoveredEvents.rows.map((row: { id: string }) => row.id)).toEqual(before.rows.map((row: { id: string }) => row.id));

    await pool.query("DELETE FROM outbox WHERE event = 'knowledge.item.collected'");
    await pool.query(
      `INSERT INTO items (source_id, url, title, content, fingerprint)
       SELECT $1, 'https://example.com/bulk/' || sequence, '批量待推' || sequence, '批量内容', 'bulk-pending-' || sequence
       FROM generate_series(1, 201) AS sequence`,
      [created.body.id]
    );
    process.env.FEED_STUB = "1";
    process.env.MT_LLM_STUB = "1";
    const bulk = await request(app.getHttpServer()).post("/api/gatherer/sources/" + created.body.id + "/collect");
    delete process.env.FEED_STUB;
    delete process.env.MT_LLM_STUB;
    expect(bulk.status).toBe(201);
    expect(bulk.body.pushedCount).toBe(201);
    const bulkEvents = await pool.query("SELECT count(*)::int AS count FROM outbox WHERE event = 'knowledge.item.collected'");
    expect(bulkEvents.rows[0].count).toBe(201);
    const unpushed = await pool.query("SELECT count(*)::int AS count FROM items WHERE source_id=$1 AND pushed_at IS NULL", [created.body.id]);
    expect(unpushed.rows[0].count).toBe(0);
  }, 15000);

  it("死信事件能在管理入口追踪", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const eventId = idempotencyKey("gatherer-dead-letter-review");
    await pool.query("DELETE FROM outbox WHERE id = $1", [eventId]);
    await appendOutbox(pool, {
      id: eventId,
      event: "gatherer.collect.dead_letter",
      source: "gatherer",
      payload: { sourceId: "source-review", runId: "run-review", error: "stub feed unavailable", maxAttempts: 5 },
      occurredAt: new Date().toISOString(),
    });
    const res = await request(app.getHttpServer()).get("/api/gatherer/meta/dead-letters");
    expect(res.status).toBe(200);
    const found = res.body.find((row: { id: string }) => row.id === eventId);
    expect(found).toMatchObject({
      sourceId: "source-review",
      runId: "run-review",
      error: "stub feed unavailable",
      status: "pending",
      attempts: 0,
    });
    await pool.query("DELETE FROM outbox WHERE id = $1", [eventId]);
  });

  it("调度状态显示实际注册与最近运行回执", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const list = await request(app.getHttpServer()).get("/api/gatherer/sources");
    for (const source of list.body) {
      const patched = await request(app.getHttpServer()).patch("/api/gatherer/sources/" + source.id).send({ cron: "0 0 31 2 *" });
      expect(patched.status).toBe(200);
    }
    const before = await request(app.getHttpServer()).get("/api/gatherer/meta/scheduler-status");
    expect(before.body.tasks.length).toBeGreaterThan(0);
    expect(before.body.tasks.every((task: { registered: boolean }) => task.registered)).toBe(true);
    const target = before.body.tasks.find((task: { sourceId: string }) => task.sourceId);
    expect(target.lastRunStatus).toBe("success");
    expect(target.lastRunFetchedCount).toBeGreaterThan(0);
    expect(target.lastRunNewCount).toBeGreaterThanOrEqual(0);
    expect(target.lastRunAt).toBeTruthy();
  });
});
