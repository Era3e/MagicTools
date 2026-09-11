import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
    finetuneStatus: vi.fn(),
    finetuneLaunch: vi.fn(),
    correctIntentLog: vi.fn(),
  },
}));

import { api } from "../api";

const notReady = {
  corrected: 10,
  threshold: 500,
  ready: false,
  launchEnabled: false,
  busy: false,
  latest: null,
};

const ready = { ...notReady, corrected: 500, ready: true, latest: { id: "1", remoteJobId: "ftj", status: "succeeded", fineTunedModel: "ftglm-x", sampleCount: 500, error: null, createdAt: "t", updatedAt: "t" } };

beforeEach(() => {
  vi.mocked(api.finetuneStatus).mockReset().mockResolvedValue(notReady);
  vi.mocked(api.finetuneLaunch).mockReset();
});

afterEach(() => cleanup());

describe("IntentLogPage 微调编排卡", () => {
  it("未就绪态：进度条百分比 + 发起按钮禁用 + 提示语", async () => {
    render(<IntentLogPage />);
    expect(await screen.findByTestId("finetune-card")).toBeTruthy();
    expect(screen.getByText("样本积累中")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText(/FT_LAUNCH_ENABLED=1/)).toBeTruthy();
    expect(screen.getByTestId("finetune-progress").textContent).toContain("2%");
    expect((screen.getByRole("button", { name: /发\s*起\s*微\s*调/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("就绪态：按钮可点，发起调用 finetuneLaunch", async () => {
    vi.mocked(api.finetuneStatus).mockResolvedValue(ready);
    vi.mocked(api.finetuneLaunch).mockResolvedValue({ jobId: "row", sampleCount: 500, remoteJobId: "ftj-2" });
    render(<IntentLogPage />);
    const btn = (await screen.findByRole("button", { name: /发\s*起\s*微\s*调/ })) as HTMLButtonElement;
    await waitFor(() => expect(btn.disabled).toBe(false));
    btn.click();
    await waitFor(() => expect(api.finetuneLaunch).toHaveBeenCalled());
    expect(screen.getByText("ftglm-x")).toBeTruthy();
  });

  it("接口失败时渲染不可用空态", async () => {
    vi.mocked(api.finetuneStatus).mockRejectedValue(new Error("down"));
    render(<IntentLogPage />);
    expect(await screen.findByText("微调编排状态不可用")).toBeTruthy();
  });
});
