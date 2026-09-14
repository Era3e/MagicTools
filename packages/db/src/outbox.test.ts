// @database-integration: required by test:db
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "./migrations";
import { appendOutbox, processOutbox, processOutboxBatch } from "./outbox";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("请通过 pnpm test:db 配置专用测试库");
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
  } catch (error) {
    // 关键数据库套件必须失败并保留原错误，不能把初始化异常变成跳过。
    throw error;
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

  it("连续失败达到上限后置为 dead 终态", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    await pool.query("DELETE FROM outbox WHERE id = $1", ["t-3"]);
    await appendOutbox(pool, {
      id: "t-3",
      event: "test.dead",
      source: "applicant",
      payload: {},
      occurredAt: new Date().toISOString(),
    });
    const fail = async () => {
      throw new Error("boom");
    };
    await processOutbox(pool, fail, { maxAttempts: 2 });
    await processOutbox(pool, fail, { maxAttempts: 2 });
    const row = await pool.query("SELECT status, attempts FROM outbox WHERE id = $1", ["t-3"]);
    expect(row.rows[0].status).toBe("dead");
    expect(row.rows[0].attempts).toBe(2);
  });

  it("并发消费者不会重复执行同一事件", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    await pool.query("DELETE FROM outbox WHERE id = $1", ["t-concurrent"]);
    await appendOutbox(pool, {
      id: "t-concurrent",
      event: "test.concurrent",
      source: "applicant",
      payload: {},
      occurredAt: new Date().toISOString(),
    });
    let handled = 0;
    const handler = async () => {
      handled += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
    };
    const [first, second] = await Promise.all([
      processOutbox(pool, handler),
      processOutbox(pool, handler),
    ]);
    expect(first + second).toBe(1);
    expect(handled).toBe(1);
  });

  it("批量处理在业务副作用完成后才标记done", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    const ids = ["t-batch-1", "t-batch-2"];
    await pool.query("DELETE FROM outbox WHERE id = ANY($1::text[])", [ids]);
    for (const [index, id] of ids.entries()) {
      await appendOutbox(pool, {
        id,
        event: "test.batch",
        source: "applicant",
        payload: { index },
        occurredAt: new Date(Date.now() + index * 1000).toISOString(),
      });
    }
    let seenIds: string[] = [];
    let statusDuringHandler: string[] = [];
    const handled = await processOutboxBatch(pool, async (events) => {
      seenIds = events.map((event) => event.id);
      const rows = await pool.query("SELECT status FROM outbox WHERE id = ANY($1::text[]) ORDER BY id", [ids]);
      statusDuringHandler = rows.rows.map((row) => row.status);
    });
    expect(handled).toBe(2);
    expect(seenIds).toEqual(ids);
    expect(statusDuringHandler).toEqual(["processing", "processing"]);
    const rows = await pool.query("SELECT status, locked_by, lease_expires_at FROM outbox WHERE id = ANY($1::text[]) ORDER BY id", [ids]);
    expect(rows.rows.map((row) => row.status)).toEqual(["done", "done"]);
    expect(rows.rows.every((row) => row.locked_by === null && row.lease_expires_at === null)).toBe(true);
  });

  it("重复append同一事件ID不新增记录", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    await pool.query("DELETE FROM outbox WHERE id = $1", ["t-duplicate"]);
    const event = {
      id: "t-duplicate",
      event: "test.duplicate",
      source: "applicant" as const,
      payload: { value: 1 },
      occurredAt: new Date().toISOString(),
    };
    await appendOutbox(pool, event);
    await appendOutbox(pool, event);
    const rows = await pool.query("SELECT count(*)::int AS count FROM outbox WHERE id = $1", [event.id]);
    expect(rows.rows[0].count).toBe(1);
  });

  it("过期租约可被新消费者恢复", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    await pool.query("DELETE FROM outbox WHERE status IN ('pending', 'retry', 'processing')");
    await pool.query("DELETE FROM outbox WHERE id = $1", ["t-expired"]);
    await appendOutbox(pool, {
      id: "t-expired",
      event: "test.expired",
      source: "applicant",
      payload: {},
      occurredAt: new Date().toISOString(),
    });
    await pool.query(
      "UPDATE outbox SET status='processing', locked_by='crashed-consumer', lease_expires_at=now()-interval '1 second' WHERE id=$1",
      ["t-expired"]
    );
    const handled: string[] = [];
    const count = await processOutbox(pool, async (event) => {
      handled.push(event.id);
    });
    expect(count).toBe(1);
    expect(handled).toEqual(["t-expired"]);
    const row = await pool.query("SELECT status, locked_by FROM outbox WHERE id=$1", ["t-expired"]);
    expect(row.rows[0]).toMatchObject({ status: "done", locked_by: null });
  });

  it("批量业务失败时整批释放租约并可重试", async (ctx) => {
    if (!available) {
      ctx.skip();
      return;
    }
    const ids = ["t-retry-1", "t-retry-2"];
    await pool.query("DELETE FROM outbox WHERE id = ANY($1::text[])", [ids]);
    for (const [index, id] of ids.entries()) {
      await appendOutbox(pool, {
        id,
        event: "test.batch-retry",
        source: "applicant",
        payload: {},
        occurredAt: new Date(Date.now() + index * 1000).toISOString(),
      });
    }
    const failed = await processOutboxBatch(pool, async () => {
      throw new Error("business failed");
    });
    expect(failed).toBe(2);
    const retryRows = await pool.query("SELECT status, attempts, locked_by, lease_expires_at FROM outbox WHERE id = ANY($1::text[])", [ids]);
    expect(retryRows.rows.map((row) => row.status)).toEqual(["retry", "retry"]);
    expect(retryRows.rows.every((row) => row.attempts === 1 && row.locked_by === null && row.lease_expires_at === null)).toBe(true);

    const handled: string[] = [];
    const retried = await processOutboxBatch(pool, async (events) => {
      handled.push(...events.map((event) => event.id));
    });
    expect(retried).toBe(2);
    expect(handled).toEqual(ids);
    const doneRows = await pool.query("SELECT status FROM outbox WHERE id = ANY($1::text[])", [ids]);
    expect(doneRows.rows.map((row) => row.status)).toEqual(["done", "done"]);
  });
});
