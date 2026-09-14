import { describe, it, expect } from "vitest";
import { buildSchedulerStatus, isValidCron } from "./scheduler";

describe("scheduler", () => {
  it("校验 cron 表达式", () => {
    expect(isValidCron("0 * * * *")).toBe(true);
    expect(isValidCron("not-a-cron")).toBe(false);
  });

  it("构建调度状态", () => {
    const status = buildSchedulerStatus(
      [{ id: "s1", name: "源A", cron: "0 * * * *", lastRunAt: "2026-09-14T00:00:00.000Z" }] as never,
      ["s1"],
      { s1: { sourceId: "s1", startedAt: "2026-09-14T00:00:00.000Z", status: "success", fetchedCount: 3, newCount: 2, error: null } }
    );
    expect(status.tasks).toHaveLength(1);
    expect(status.tasks[0]).toMatchObject({ sourceId: "s1", registered: true, lastRunStatus: "success", lastRunFetchedCount: 3, lastRunNewCount: 2 });
  });
});
