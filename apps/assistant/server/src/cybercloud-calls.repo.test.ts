import { afterAll, describe, expect, it } from "vitest";
import { ensureDatabase, migrate, pool } from "./db";
import { insertCybercloudCall, listCybercloudCalls, markVerifyStatus } from "./cybercloud-calls.repo";

afterAll(async () => {
  await pool.end();
});

describe("cybercloud_calls repo", () => {
  it("插入与查询", async () => {
    await ensureDatabase();
    await migrate();
    const marker = "tc-" + Date.now();
    await insertCybercloudCall({ route: "direct", endpoint: "queryByStructure", ok: true, latencyMs: 120, detail: { metricName: "本月销售额", value: 12345, marker } });
    const rows = await listCybercloudCalls(200);
    const row = rows.find((r) => (r.detail as Record<string, unknown>).marker === marker);
    expect(row?.route).toBe("direct");
    expect(row?.ok).toBe(true);
  });
  it("verify 终态回写", async () => {
    await ensureDatabase();
    await migrate();
    const marker = "tv-" + Date.now();
    const inserted = await insertCybercloudCall({ route: "agent", endpoint: "block", ok: true, latencyMs: 30000, detail: { marker } });
    await markVerifyStatus(inserted.id, "divergent", 710);
    const rows = await listCybercloudCalls(200);
    const row = rows.find((r) => r.id === inserted.id);
    expect((row?.detail as Record<string, unknown>).verify_status).toBe("divergent");
    expect((row?.detail as Record<string, unknown>).diff_pct).toBe(710);
  });
});
