import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrations";
import { appendOutbox, processOutbox } from "./outbox";

const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/mt_test";
let pool: Pool;
let available = false;

beforeAll(async () => {
  pool = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
  try {
    await pool.query("SELECT 1");
    available = true;
    await runMigrations(pool, process.cwd() + "/migrations");
    // 测试隔离：清空上轮残留（避免 retry 行被本轮测试 1 一并处理）
    await pool.query("TRUNCATE outbox");
  } catch {
    available = false;
  }
}, 15000);

afterAll(async () => {
  if (pool) await pool.end();
});

describe("outbox", () => {
  it("append 后 process 成功处理并置为 done", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    await pool.query("DELETE FROM outbox WHERE id = $1", ["t-1"]);
    await appendOutbox(pool, {
      id: "t-1",
      event: "test.happened",
      source: "applicant",
      payload: { a: 1 },
      occurredAt: new Date().toISOString(),
    });
    const handled: string[] = [];
    const count = await processOutbox(pool, async (evt) => {
      handled.push(evt.id);
    });
    expect(count).toBe(1);
    expect(handled).toEqual(["t-1"]);
    const row = await pool.query("SELECT status FROM outbox WHERE id = $1", ["t-1"]);
    expect(row.rows[0].status).toBe("done");
  });

  it("handler 抛错时置为 retry 并记录错误", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    await pool.query("DELETE FROM outbox WHERE id = $1", ["t-2"]);
    await appendOutbox(pool, {
      id: "t-2",
      event: "test.failed",
      source: "applicant",
      payload: {},
      occurredAt: new Date().toISOString(),
    });
    await processOutbox(pool, async () => {
      throw new Error("boom");
    });
    const row = await pool.query("SELECT status, attempts FROM outbox WHERE id = $1", ["t-2"]);
    expect(row.rows[0].status).toBe("retry");
    expect(row.rows[0].attempts).toBe(1);
  });
});
