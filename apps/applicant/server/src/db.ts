import { join } from "node:path";
import { createPool, runMigrations } from "@mt/db";

export const pool = createPool(
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/applicant"
);

export async function migrate(): Promise<void> {
  // 按源码/编译产物位置解析，而非 cwd（CI 从仓库根启动，本地 dev 从包目录启动，两处都需正确）
  await runMigrations(pool, join(__dirname, "..", "migrations"));
}
