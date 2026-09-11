import { Pool } from "pg";

export function createPool(connectionString: string): Pool {
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 2000 });
  pool.on("error", (error) => {
    // pg 会移除失效的空闲连接；保留进程，下一次查询可以重连。查询本身的错误仍正常拒绝。
    const code = (error as { code?: string }).code;
    console.warn("[database] idle connection failed", code && /^[0-9A-Z]{5}$/.test(code) ? code : "connection-error");
  });
  return pool;
}
