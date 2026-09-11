import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseReadiness } from "./readiness";
import { createPool } from "./pool";

const directories: string[] = [];
function migrations(names: string[] = ["001_core.sql", "002_feature.sql"]) {
  const directory = mkdtempSync(join(tmpdir(), "mt-ready-review-"));
  directories.push(directory);
  for (const name of names) writeFileSync(join(directory, name), "SELECT 1;\n");
  return directory;
}
function pool(query: ReturnType<typeof vi.fn>) {
  return { query } as unknown as Pick<Pool, "query">;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep + "mt-ready-review-")) throw new Error("Unexpected cleanup target");
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("readiness 独立验收", () => {
  it("空闲连接断开事件不能终止服务，也不记录原错误中的密码", async () => {
    const messages: unknown[][] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation((...args) => { messages.push(args); });
    const error = vi.spyOn(console, "error").mockImplementation((...args) => { messages.push(args); });
    const secret = "independent-idle-secret";
    const connectionPool = createPool("postgres://user:" + secret + "@127.0.0.1:1/mt_review_test");
    try {
      expect(() => connectionPool.emit("error", new Error("database unavailable: " + secret))).not.toThrow();
      expect(messages.flat().map(String).join(" ")).not.toContain(secret);
    } finally {
      await connectionPool.end();
      warn.mockRestore(); error.mockRestore();
    }
  });

  it("目录缺失和没有 SQL 资源时均拒绝就绪，且不访问数据库", async () => {
    const directory = migrations(["README.md"]);
    const query = vi.fn();
    expect(await databaseReadiness(pool(query), join(directory, "missing"))).toEqual({ ready: false, reason: "migration-files-missing" });
    expect(await databaseReadiness(pool(query), directory)).toEqual({ ready: false, reason: "migration-files-missing" });
    expect(query).not.toHaveBeenCalled();
  });

  it("账本中缺少任意所需迁移时拒绝就绪，全部应用后可恢复", async () => {
    const directory = migrations();
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ applied: 1 }] }).mockResolvedValueOnce({ rows: [{ applied: 2 }] });
    expect(await databaseReadiness(pool(query), directory)).toEqual({ ready: false, reason: "migrations-pending" });
    expect(await databaseReadiness(pool(query), directory)).toEqual({ ready: true });
    const config = query.mock.calls[0][0] as { values: string[][]; query_timeout: number };
    expect(new Set(config.values[0])).toEqual(new Set(["001_core.sql", "002_feature.sql"]));
    expect(config.query_timeout).toBeGreaterThan(0);
    expect(config.query_timeout).toBeLessThanOrEqual(5000);
  });

  it("凭证、断连和超时错误均降为不就绪，原错误中的秘密不出现在结果", async () => {
    const directory = migrations();
    const secret = "independent-review-password";
    for (const code of ["28P01", "ECONNREFUSED", "ETIMEDOUT"]) {
      const error = Object.assign(new Error("postgres://user:" + secret + "@private/database"), { code, detail: secret });
      const query = vi.fn().mockRejectedValue(error);
      const result = await databaseReadiness(pool(query), directory);
      expect(result).toEqual({ ready: false, reason: "database-unavailable" });
      expect(JSON.stringify(result)).not.toContain(secret);
      expect(JSON.stringify(result)).not.toContain("private");
    }
  });

  it("每次就绪探测重新查询，先成功后断连不能沿用历史成功", async () => {
    const directory = migrations();
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ applied: 2 }] })
      .mockRejectedValueOnce(new Error("connection lost"))
      .mockResolvedValueOnce({ rows: [{ applied: 2 }] });
    expect(await databaseReadiness(pool(query), directory)).toEqual({ ready: true });
    expect(await databaseReadiness(pool(query), directory)).toEqual({ ready: false, reason: "database-unavailable" });
    expect(await databaseReadiness(pool(query), directory)).toEqual({ ready: true });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("空结果、非数字和超出实际文件数的计数都不能形成就绪成功", async () => {
    const directory = migrations();
    for (const rows of [[], [{ applied: undefined }], [{ applied: "invalid" }], [{ applied: 3 }]]) {
      const query = vi.fn().mockResolvedValue({ rows });
      expect((await databaseReadiness(pool(query), directory)).ready).toBe(false);
    }
  });
});
