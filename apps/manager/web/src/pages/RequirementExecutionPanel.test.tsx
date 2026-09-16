import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RequirementExecutionPanel from "./RequirementExecutionPanel";
import { api } from "../api";

vi.mock("../api", () => ({ api: { listExecutionJobs: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("需求执行进度面板", () => {
  it("展示运行证据、失败原因，并区分PR与部署状态", async () => {
    vi.mocked(api.listExecutionJobs).mockResolvedValue([{
      id: "job-1",
      requirementId: "req-1",
      requirementRevision: 3,
      contentRevision: 2,
      status: "succeeded",
      attempts: 1,
      maxAttempts: 2,
      cancellationReason: "",
      createdAt: "2026-09-16T00:00:00Z",
      updatedAt: "2026-09-16T00:01:00Z",
      startedAt: "2026-09-16T00:00:10Z",
      finishedAt: "2026-09-16T00:01:00Z",
      contract: {
        repository: "https://github.com/Era3e/MagicTools",
        allowedPaths: ["apps/manager"],
        acceptanceCommands: [["pnpm", "test"]],
        maxDurationMinutes: 5,
        maxAttempts: 2,
        budgetCurrency: "CNY",
        budgetAmountCents: 500,
      },
      runs: [{
        id: "run-1", attempt: 1, status: "succeeded", executorId: "executor-a",
        heartbeatAt: "2026-09-16T00:00:30Z", leaseExpiresAt: "2026-09-16T00:01:00Z",
        hardDeadlineAt: "2026-09-16T00:05:00Z",
        result: {
          candidateSha: "b".repeat(40), baseSha: "a".repeat(40),
          prUrl: "https://github.com/Era3e/MagicTools/pull/97", branch: "auto/req-demo/r1",
          changedPaths: ["apps/manager/server/src/a.ts"],
          acceptance: [{ status: "success", exitCode: 0, durationMs: 1200 }],
          evidence: { schema: "magictools-executor-evidence/1", path: "evidence/evidence.json", sha256: "c".repeat(64) },
        },
        error: "", createdAt: "2026-09-16T00:00:10Z", updatedAt: "2026-09-16T00:01:00Z", finishedAt: "2026-09-16T00:01:00Z",
      }, {
        id: "run-0", attempt: 0, status: "failed", executorId: "executor-old",
        heartbeatAt: "2026-09-15T00:00:30Z", leaseExpiresAt: "2026-09-15T00:01:00Z",
        hardDeadlineAt: "2026-09-15T00:05:00Z", result: null, error: "acceptance timeout",
        createdAt: "2026-09-15T00:00:10Z", updatedAt: "2026-09-15T00:01:00Z", finishedAt: "2026-09-15T00:01:00Z",
      }],
    }]);

    render(<RequirementExecutionPanel item={{
      id: "req-1", revision: 4, title: "执行需求", description: "", source: "manual", sourceRef: "",
      status: "accepting", priority: "P1", branch: "auto/req-demo/r1", prUrl: "https://github.com/Era3e/MagicTools/pull/97",
      prState: "open", deploymentState: "not-started", timeline: [], labels: [], iterationId: null,
      sourcePayload: null, updatedAt: "2026-09-16T00:01:00Z",
    } as never} />);

    expect(await screen.findByText("执行进度与待验收")).toBeTruthy();
    expect(screen.getByText(/bbbb/)).toBeTruthy();
    expect(screen.getByText("acceptance timeout")).toBeTruthy();
    expect(screen.getByText("PR 状态：open")).toBeTruthy();
    expect(screen.getByText("部署状态：not-started")).toBeTruthy();
    expect(screen.getByText(/执行成功只代表候选通过契约验收/)).toBeTruthy();
    await waitFor(() => expect(api.listExecutionJobs).toHaveBeenCalledWith("req-1"));
  });

  it("没有执行任务时显示明确空态", async () => {
    vi.mocked(api.listExecutionJobs).mockResolvedValue([]);
    render(<RequirementExecutionPanel item={{ id: "req-2" } as never} />);
    expect(await screen.findByText("暂无自动执行任务")).toBeTruthy();
  });
});
