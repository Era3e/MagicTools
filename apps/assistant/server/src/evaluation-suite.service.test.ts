import { beforeEach, describe, expect, it, vi } from "vitest";
import { EvaluationSuiteService } from "./evaluation-suite.service";
import type { EvaluationCaseRow, EvaluationRunRow } from "./evaluation-suite.repo";

vi.mock("./evaluation-suite.repo", () => ({
  createEvaluationRun: vi.fn(),
  failEvaluationRun: vi.fn(),
  finishEvaluationRun: vi.fn(),
  getEvaluationRun: vi.fn(),
  insertEvaluationRunItem: vi.fn(),
  listEvaluationCases: vi.fn(),
  listEvaluationRunItems: vi.fn(async () => []),
  listEvaluationRuns: vi.fn(async () => []),
  listMissingCaseIds: vi.fn(async () => []),
  recoverAbandonedEvaluationRuns: vi.fn(async () => 0),
  touchEvaluationRun: vi.fn(),
}));

import {
  createEvaluationRun,
  finishEvaluationRun,
  insertEvaluationRunItem,
  listEvaluationCases,
  listMissingCaseIds,
  touchEvaluationRun,
} from "./evaluation-suite.repo";

function caseRow(id: string, type: EvaluationCaseRow["caseType"]): EvaluationCaseRow {
  return {
    id,
    caseKey: id,
    caseType: type,
    split: "dev",
    message: id,
    history: [],
    expected:
      type === "routing"
        ? { domain: "magictools", intent: "product_inquiry" }
        : type === "knowledge"
          ? { contains: [], forbidden: [], minCitations: 0 }
          : { action: "create_requirement", params: {} },
    enabled: true,
    datasetVersion: 1,
  };
}

function runRow(id: string): EvaluationRunRow {
  return {
    id,
    label: "test",
    split: "dev",
    datasetFingerprint: "fingerprint",
    configSnapshot: {},
    status: "completed",
    expectedTotal: 1,
    passCount: 1,
    failCount: 0,
    errorCount: 0,
    timeoutCount: 0,
    missingCount: 0,
    error: null,
    startedAt: "2026-09-15T00:00:00Z",
    finishedAt: "2026-09-15T00:00:01Z",
  };
}

describe("EvaluationSuiteService", () => {
  beforeEach(() => {
    vi.mocked(createEvaluationRun).mockReset().mockResolvedValue(runRow("run-1"));
    vi.mocked(listEvaluationCases).mockReset();
    vi.mocked(insertEvaluationRunItem).mockReset().mockResolvedValue();
    vi.mocked(touchEvaluationRun).mockReset().mockResolvedValue();
    vi.mocked(listMissingCaseIds).mockReset().mockResolvedValue([]);
    vi.mocked(finishEvaluationRun).mockReset();
    process.env.EVALUATION_TIMEOUT_MS = "1000";
  });

  it("action 评测只调用 parse，不执行网关动作", async () => {
    vi.mocked(listEvaluationCases).mockResolvedValue([caseRow("action-1", "action")]);
    vi.mocked(finishEvaluationRun).mockResolvedValue({ ...runRow("run-1"), expectedTotal: 1, passCount: 1 });
    const parse = vi.fn(async () => ({ action: "create_requirement", params: {} }));
    const execute = vi.fn();
    const service = new EvaluationSuiteService({} as never, {} as never, { parse, execute } as never);
    const result = await service.run("dev", "manual");
    expect(parse).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
    expect(result.itemCount).toBe(1);
    expect(vi.mocked(insertEvaluationRunItem).mock.calls[0][0]).toMatchObject({ status: "pass" });
  });

  it("单 case 超时会落 timeout 明细而不是中断整个 run", async () => {
    vi.mocked(listEvaluationCases).mockResolvedValue([caseRow("route-1", "routing")]);
    vi.mocked(finishEvaluationRun).mockResolvedValue({ ...runRow("run-1"), passCount: 0, timeoutCount: 1 });
    const service = new EvaluationSuiteService(
      { classify: vi.fn(() => new Promise(() => undefined)) } as never,
      {} as never,
      {} as never
    );
    process.env.EVALUATION_TIMEOUT_MS = "1";
    const result = await service.run("dev", "manual");
    expect(result.status).toBe("completed");
    expect(vi.mocked(insertEvaluationRunItem).mock.calls[0][0]).toMatchObject({ status: "timeout", reason: "评测执行超时" });
  });

  it("缺明细的 case 会在收尾前补 missing 并保持 expected_total 硬约束", async () => {
    vi.mocked(listEvaluationCases).mockResolvedValue([caseRow("route-1", "routing"), caseRow("route-2", "routing")]);
    const written: string[] = [];
    vi.mocked(insertEvaluationRunItem).mockImplementation(async (input) => {
      if (input.caseId === "route-2" && input.status !== "missing") return;
      written.push(input.status);
    });
    vi.mocked(listMissingCaseIds).mockResolvedValue([
      { id: "route-2", caseKey: "route-2", caseType: "routing", expected: {} },
    ]);
    vi.mocked(finishEvaluationRun).mockResolvedValue({
      ...runRow("run-1"),
      expectedTotal: 2,
      passCount: 1,
      missingCount: 1,
    });
    const service = new EvaluationSuiteService(
      { classify: vi.fn(async () => ({ domain: "magictools", intent: "product_inquiry", confidence: 1 })) } as never,
      {} as never,
      {} as never
    );
    const result = await service.run("dev", "manual");
    expect(written).toEqual(["pass", "missing"]);
    expect(result.itemCount).toBe(2);
  });
});
