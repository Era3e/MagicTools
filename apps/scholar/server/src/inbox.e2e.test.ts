import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { appendOutbox } from "@mt/db";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "./app.module";
import { ensureDatabase, gathererPool, migrate, pool } from "./db";

const OUTBOX_DDL = `CREATE TABLE IF NOT EXISTS outbox (
  id text PRIMARY KEY,
  event text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz
)`;

function payload() {
  return {
    itemId: "11111111-1111-1111-1111-111111111111",
    url: "https://example.com/a",
    title: "行业新闻标题",
    content: "行业新闻正文",
    summary: "摘要",
    category: "行业资讯",
    keywords: ["行业", "新闻"],
    publishedAt: null,
  };
}

let app: INestApplication;
let available = false;

beforeAll(async () => {
  try {
    process.env.MT_LLM_STUB = "1";
    await ensureDatabase();
    await migrate();
    await gathererPool.query(OUTBOX_DDL);
    available = true;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/scholar");
    await app.init();
  } catch {
    available = false;
  }
}, 30000);

afterAll(async () => {
  if (app) await app.close();
});

beforeEach(async () => {
  if (!available) return;
  await gathererPool.query("DELETE FROM outbox WHERE event = 'knowledge.item.collected'");
  await pool.query("TRUNCATE entry_entities, relations, entities, entries CASCADE");
});

describe("inbox", () => {
  it("POST /api/scholar/inbox/poll 消费 gatherer 事件入库", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await appendOutbox(gathererPool, {
      id: "inbox-test-1",
      event: "knowledge.item.collected",
      source: "gatherer",
      payload: payload(),
      occurredAt: new Date().toISOString(),
    });
    const res = await request(app.getHttpServer()).post("/api/scholar/inbox/poll");
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(1);
    const rows = await pool.query("SELECT * FROM entries WHERE source = 'gatherer'");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].source_ref).toBe("11111111-1111-1111-1111-111111111111");
    expect(rows.rows[0].title).toBe("行业新闻标题");
    expect(rows.rows[0].tags).toEqual(["行业", "新闻"]);
    expect(rows.rows[0].embedding).not.toBeNull();
  });

  it("重复 poll 幂等不重复入库", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    await appendOutbox(gathererPool, {
      id: "inbox-test-2",
      event: "knowledge.item.collected",
      source: "gatherer",
      payload: payload(),
      occurredAt: new Date().toISOString(),
    });
    const first = await request(app.getHttpServer()).post("/api/scholar/inbox/poll");
    expect(first.body.created).toBe(1);
    const second = await request(app.getHttpServer()).post("/api/scholar/inbox/poll");
    expect(second.status).toBe(201);
    expect(second.body.created).toBe(0);
    expect(second.body.skipped).toBe(1);
    const rows = await pool.query("SELECT count(*)::int AS n FROM entries WHERE source = 'gatherer'");
    expect(rows.rows[0].n).toBe(1);
  });
});
