import { join } from "node:path";
import { Pool } from "pg";
import { createPool, runMigrations } from "@mt/db";

const DEFAULT_URL = "postgres://postgres:postgres@127.0.0.1:5432/investigator";

export const pool = createPool(process.env.DATABASE_URL ?? DEFAULT_URL);

// 数据库自举：目标库不存在（3D000）时连 postgres 维护库自动创建（本地/CI/生产通用，免手工 createdb）
export async function ensureDatabase(url = process.env.DATABASE_URL ?? DEFAULT_URL): Promise<void> {
  const target = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    try {
      await target.query("SELECT 1");
      return;
    } catch (err) {
      if ((err as { code?: string }).code !== "3D000") throw err;
    }
    const parsed = new URL(url);
    const dbName = parsed.pathname.slice(1);
    if (!/^[a-z_][a-z0-9_]*$/.test(dbName)) {
      throw new Error("数据库名非法: " + dbName);
    }
    parsed.pathname = "/postgres";
    const admin = new Pool({ connectionString: parsed.toString(), connectionTimeoutMillis: 5000 });
    try {
      await admin.query('CREATE DATABASE "' + dbName + '"');
    } finally {
      await admin.end();
    }
    await target.query("SELECT 1");
  } finally {
    await target.end();
  }
}

export async function migrate(): Promise<void> {
  // 按源码/编译产物位置解析，而非 cwd（CI 从仓库根启动，本地 dev 从包目录启动）
  await runMigrations(pool, join(__dirname, "..", "migrations"));
}
