import { join } from "node:path";
import { Pool } from "pg";
import { createPool, runMigrations } from "@mt/db";

const DEFAULT_URL = "postgres://postgres:postgres@127.0.0.1:5432/designer";

export const pool = createPool(process.env.DATABASE_URL ?? DEFAULT_URL);

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
    if (!/^[a-z_][a-z0-9_]*$/.test(dbName)) throw new Error("数据库名非法: " + dbName);
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
  await runMigrations(pool, join(__dirname, "..", "migrations"));
}
