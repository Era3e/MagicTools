import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IntentLogPage from "./IntentLogPage";

vi.mock("../api", () => ({
  api: {
    listIntentLogs: vi.fn(async () => []),
    intentEvaluation: vi.fn(async () => ({ confusion: { matrix: {}, labels: [], total: 0, diagHits: 0 }, stats: [] })),
    intentReplay: vi.fn(async () => ({ total: 0, hits: 0, accuracy: 0, misses: [] })),
    datasetPreview: vi.fn(async () => ({ count: 0, preview: [] })),
    exportDataset: vi.fn(async () => ({ jsonl: "", count: 0 })),
    listCybercloudCalls: vi.fn(async () => []),
    finetuneStatus: vi.fn(async () => ({
      corrected: 10,
      threshold: 500,
      ready: false,
      launchEnabled: false,
      busy: false,
      latest: null,
    })),
    finetuneLaunch: vi.fn(),
    correctIntentLog: vi.fn(),
    evaluationCases: vi.fn(async () => ({
      total: 48,
      bySplit: { dev: 24, regression: 16, holdout: 8 },
      byType: { routing: 36, knowledge: 6, action: 6 },
    })),
    listEvaluationRuns: vi.fn(async () => [
      {
        id: "run-1",
        label: "baseline",
        split: "dev",
        datasetFingerprint: "fingerprint",
        configSnapshot: { llmMode: "stub", provider: "zhipu", model: "glm-4-flash" },
        status: "completed",
        expectedTotal: 24,
        passCount: 23,
        failCount: 1,
        errorCount: 0,
        timeoutCount: 0,
        missingCount: 0,
        error: null,
        startedAt: "2026-09-15T00:00:00Z",
        finishedAt: "2026-09-15T00:00:10Z",
      },
    ]),
    createEvaluationRun: vi.fn(async () => ({
      id: "run-2",
      label: "manual",
      split: "dev",
      datasetFingerprint: "fingerprint",
      configSnapshot: { llmMode: "stub" },
      status: "completed",
      expectedTotal: 24,
      passCount: 24,
      failCount: 0,
      errorCount: 0,
      timeoutCount: 0,
      missingCount: 0,
      error: null,
      startedAt: "2026-09-15T00:00:20Z",
      finishedAt: "2026-09-15T00:00:30Z",
      itemCount: 24,
    })),
    compareEvaluationRuns: vi.fn(async () => ({
      summary: { fixed: 1, regressed: 0, error: 0, timeout: 0, missing: 0, unchanged: 23 },
      transitions: [{ caseId: "case-1", baseline: "fail", current: "pass", kind: "fixed" }],
    })),
  },
}));

import { api } from "../api";

beforeEach(() => {
  vi.mocked(api.compareEvaluationRuns).mockClear();
});

afterEach(() => cleanup());

describe("IntentLogPage 独立评测卡", () => {
  it("展示种子分布并支持发起 dev run", async () => {
    render(<IntentLogPage />);
    expect(await screen.findByTestId("evaluation-suite-card")).toBeTruthy();
    expect(screen.getByText(/dev 24/)).toBeTruthy();
    expect(screen.getByText(/regression 16/)).toBeTruthy();
    expect(screen.getByText(/holdout 8/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /运行评测/ }));
    await waitFor(() => expect(api.createEvaluationRun).toHaveBeenCalledWith("dev", "manual"));
    const card = await screen.findByTestId("evaluation-suite-card");
    await waitFor(() => expect(card.dataset.latestRun).toBe("run-2"));
  });

  it("选择 baseline/current 后展示版本比较", async () => {
    render(<IntentLogPage />);
    await screen.findByText("run-1");
    fireEvent.click(screen.getByRole("button", { name: /比较版本/ }));
    await waitFor(() => expect(api.compareEvaluationRuns).toHaveBeenCalled());
    const card = await screen.findByTestId("evaluation-suite-card");
    await waitFor(() => expect(card.dataset.comparisonFixed).toBe("1"));
    expect(await screen.findByText("case-1")).toBeTruthy();
  });
});
