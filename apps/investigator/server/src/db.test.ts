// @database-integration: required by test:db
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { ensureDatabase } from "./db";

let available = false;
const adminUrl = process.env.MT_TEST_ADMIN_URL;
const testUrl = process.env.MT_TEST_BOOTSTRAP_DATABASE_URL;
if (!adminUrl || !testUrl) throw new Error("请通过 pnpm test:db 分配自举验证专用库");
const testDatabase = new URL(testUrl).pathname.slice(1);
if (!/^mt_[a-z0-9_]+_test$/.test(testDatabase)) throw new Error("拒绝清理非专用测试库");

beforeAll(async () => {
  const probe = new Pool({ connectionString: adminUrl, connectionTimeoutMillis: 2000 });
  try {
    await probe.query("SELECT 1");
    available = true;
  } catch (error) {
    // 关键数据库套件必须失败并保留原错误，不能把初始化异常变成跳过。
    throw error;
  } finally {
    await probe.end();
  }
}, 15000);

afterAll(async () => {
  if (available) {
    const admin = new Pool({ connectionString: adminUrl });
    await admin.query(`DROP DATABASE IF EXISTS "${testDatabase}"`);
    await admin.end();
  }
});

describe("ensureDatabase 自举", () => {
  it("目标库不存在时自动创建", async (ctx) => {
    if (!available) { ctx.skip(); return; }
    const admin = new Pool({ connectionString: adminUrl });
    const absent = await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [testDatabase]);
    expect(absent.rowCount).toBe(0);
    await admin.end();
    await ensureDatabase(testUrl);
    const check = new Pool({ connectionString: testUrl, connectionTimeoutMillis: 2000 });
    const res = await check.query("SELECT 1");
    expect(res.rowCount).toBe(1);
    await check.end();
  });
});
