import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { ensureDatabase } from "./db";

let available = false;

beforeAll(async () => {
  const probe = new Pool({ connectionString: "postgres://postgres:postgres@127.0.0.1:5432/postgres", connectionTimeoutMillis: 2000 });
  try {
    await probe.query("SELECT 1");
    available = true;
  } catch {
    available = false;
  } finally {
    await probe.end();
  }
}, 15000);

afterAll(async () => {
  if (available) {
    const admin = new Pool({ connectionString: "postgres://postgres:postgres@127.0.0.1:5432/postgres" });
    await admin.query("DROP DATABASE IF EXISTS invtest_tmp");
    await admin.end();
  }
});

describe("ensureDatabase 自举", () => {
  it("目标库不存在时自动创建", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const url = "postgres://postgres:postgres@127.0.0.1:5432/invtest_tmp";
    await ensureDatabase(url);
    const check = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
    const res = await check.query("SELECT 1");
    expect(res.rowCount).toBe(1);
    await check.end();
  });
});
