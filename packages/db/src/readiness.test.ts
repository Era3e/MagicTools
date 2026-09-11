import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import type { Pool } from "pg";
import { expect, it, vi } from "vitest";
import { databaseReadiness } from "./readiness";

it("只有全部迁移已应用且数据库可查询时才就绪", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mt-ready-"));
  writeFileSync(join(directory, "001_core.sql"), "SELECT 1");
  writeFileSync(join(directory, "002_feature.sql"), "SELECT 1");
  const query = vi.fn().mockResolvedValueOnce({ rows: [{ applied: 1 }] }).mockResolvedValueOnce({ rows: [{ applied: 2 }] });
  try {
    expect(await databaseReadiness({ query } as unknown as Pool, directory)).toMatchObject({ ready: false, reason: "migrations-pending" });
    expect(await databaseReadiness({ query } as unknown as Pool, directory)).toMatchObject({ ready: true });
  } finally {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep + "mt-ready-")) throw new Error("Unexpected cleanup target");
    rmSync(directory, { recursive: true });
  }
});

it("缺迁移资源或数据库断连时不就绪且不回传连接秘密", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mt-ready-"));
  const query = vi.fn().mockRejectedValue(new Error("postgres://private-secret@unavailable"));
  try {
    expect(await databaseReadiness({ query } as unknown as Pool, directory)).toEqual({ ready: false, reason: "migration-files-missing" });
    expect(query).not.toHaveBeenCalled();
    writeFileSync(join(directory, "001_core.sql"), "SELECT 1");
    const result = await databaseReadiness({ query } as unknown as Pool, directory);
    expect(result).toEqual({ ready: false, reason: "database-unavailable" });
    expect(JSON.stringify(result)).not.toContain("private-secret");
  } finally {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep + "mt-ready-")) throw new Error("Unexpected cleanup target");
    rmSync(directory, { recursive: true });
  }
});
