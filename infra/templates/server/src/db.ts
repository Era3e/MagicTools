import { join } from "node:path";
import { createPool, runMigrations } from "@mt/db";

export const pool = createPool(process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/__NAME__");
export async function migrate() { await runMigrations(pool, join(__dirname, "..", "migrations")); }
