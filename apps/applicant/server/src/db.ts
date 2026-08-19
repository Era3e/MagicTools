import { createPool, runMigrations } from "@mt/db";

export const pool = createPool(
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/applicant"
);

export async function migrate(): Promise<void> {
  await runMigrations(pool, process.cwd() + "/migrations");
}
