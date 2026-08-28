import { describe, it, expect } from "vitest";
import { buildSchedulerStatus, isValidCron } from "./scheduler";

describe("scheduler", () => {
  it("校验 cron 表达式", () => {
    expect(isValidCron("0 * * * *")).toBe(true);
    expect(isValidCron("*/5 * * * *")).toBe(true);
    expect(isValidCron("not-a-cron")).toBe(false);
    expect(isValidCron("")).toBe(false);
  });

  it("构建调度状态", () => {
    const status = buildSchedulerStatus([
      { id: "s1", name: "调研A", cron: "0 * * * *" },
      { id: "s2", name: "调研B", cron: "*/15 * * * *" },
    ] as never);
    expect(status.tasks).toHaveLength(2);
    expect(status.tasks[0].surveyId).toBe("s1");
    expect(status.tasks[0].name).toBe("调研A");
    expect(status.tasks[0].cron).toBe("0 * * * *");
  });

  it("空输入构建空状态", () => {
    const status = buildSchedulerStatus([] as never);
    expect(status.tasks).toHaveLength(0);
  });
});
