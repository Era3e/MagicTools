import { Pool } from "pg";
import { expect, it } from "vitest";

it("普通单测不能意外发起 PostgreSQL 查询", async () => {
  const pool = new Pool({ host: "127.0.0.1", port: 1, connectionTimeoutMillis: 100 });
  try {
    expect(() => {
      const pending = pool.query("SELECT 1");
      void pending.catch(() => undefined);
    }).toThrow(/test:db/);
  } finally { await pool.end(); }
});
