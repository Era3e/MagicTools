import { describe, it, expect } from "vitest";
import { buildSchedulerStatus, isValidCron } from "./scheduler";

describe("scheduler", () => {
  it("校验 cron 表达式", () => {
    expect(isValidCron("0 * * * *")).toBe(true);
    expect(isValidCron("not-a-cron")).toBe(false);
  });

  it("构建调度状态", () => {
    const status = buildSchedulerStatus([{ id: "s1", name: "源A", cron: "0 * * * *" }] as never);
    expect(status.tasks).toHaveLength(1);
    expect(status.tasks[0].sourceId).toBe("s1");
  });
});
