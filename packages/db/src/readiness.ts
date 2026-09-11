import { readdirSync } from "node:fs";
import type { Pool, QueryConfig } from "pg";

export async function databaseReadiness(pool: Pick<Pool, "query">, migrationsDirectory: string) {
  let names: string[];
  try { names = readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql")); }
  catch { return { ready: false as const, reason: "migration-files-missing" }; }
  if (!names.length) return { ready: false as const, reason: "migration-files-missing" };
  try {
    const query: QueryConfig & { query_timeout: number } = {
      text: "SELECT count(*)::integer AS applied FROM schema_migrations WHERE name = ANY($1::text[])",
      values: [names], query_timeout: 2000,
    };
    const result = await pool.query<{ applied: number }>(query);
    const applied = Number(result.rows[0]?.applied ?? 0);
    return applied === names.length ? { ready: true as const } : { ready: false as const, reason: "migrations-pending" };
  } catch {
    return { ready: false as const, reason: "database-unavailable" };
  }
}
