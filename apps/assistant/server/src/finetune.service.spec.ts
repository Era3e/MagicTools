import { describe, expect, it, vi } from "vitest";
import { FinetuneService } from "./finetune.service";
import { EvaluationService } from "./evaluation.service";

vi.mock("./db", () => ({ pool: { query: vi.fn() } }));
vi.mock("./intent-log.repo", () => ({
  countCorrectedLogs: vi.fn(async () => 3),
  listCorrectedLogs: vi.fn(async () => []),
}));
vi.mock("./finetune.repo", () => ({
  hasRunningFinetuneJob: vi.fn(async () => false),
  getLatestFinetuneJob: vi.fn(async () => null),
  insertFinetuneJob: vi.fn(async () => ({
    id: "row-1", remoteJobId: "ftjob-stub-1", remoteFileId: "file-stub-1", baseModel: "glm-4-flash",
    sampleCount: 3, status: "created", fineTunedModel: null, error: null, createdAt: "t", updatedAt: "t",
  })),
  updateFinetuneJob: vi.fn(async () => null),
}));
vi.mock("./evaluation.service", () => ({
  EvaluationService: class {
    async exportDataset() {
      return { jsonl: '{"messages":[]}\n{"messages":[]}\n{"messages":[]}', count: 3 };
    }
  },
}));

describe("FinetuneService（FT_STUB 全链路）", () => {
  const mkSvc = () => new FinetuneService(new EvaluationService(null as never));

  it("launch 默认禁用：FT_LAUNCH_ENABLED 未设 → 403 launch_disabled", async () => {
    delete process.env.FT_LAUNCH_ENABLED;
    process.env.FT_STUB = "1";
    const svc = mkSvc();
    await expect(svc.launch()).rejects.toMatchObject({ status: 403 });
    delete process.env.FT_STUB;
  });

  it("launch 启用 + 桩模式：小样本可走通全链路（upload → createJob → 落库）", async () => {
    process.env.FT_LAUNCH_ENABLED = "1";
    process.env.FT_STUB = "1";
    const svc = mkSvc();
    const res = await svc.launch();
    expect(res.remoteJobId).toMatch(/^ftjob-stub-/);
    expect(res.sampleCount).toBe(3);
    delete process.env.FT_LAUNCH_ENABLED;
    delete process.env.FT_STUB;
  });

  it("真跑模式样本不足 → 409 samples_below_threshold", async () => {
    process.env.FT_LAUNCH_ENABLED = "1";
    delete process.env.FT_STUB;
    const svc = mkSvc();
    try {
      await svc.launch();
      expect.unreachable();
    } catch (err) {
      expect((err as { status?: number; getResponse?: () => { error?: string } }).status ?? (err as { getStatus?: () => number }).getStatus?.()).toBe(409);
      const res = typeof (err as { getResponse?: () => unknown }).getResponse === "function" ? ((err as { getResponse: () => { error?: string } }).getResponse()) : null;
      expect(res?.error).toBe("samples_below_threshold");
    }
    delete process.env.FT_LAUNCH_ENABLED;
  });

  it("status：无任务时返回就绪度与 launchEnabled", async () => {
    process.env.FT_STUB = "1";
    const svc = mkSvc();
    const s = await svc.status();
    expect(s.corrected).toBe(3);
    expect(s.threshold).toBe(500);
    expect(s.ready).toBe(false);
    expect(s.launchEnabled).toBe(false);
    expect(s.latest).toBeNull();
    delete process.env.FT_STUB;
  });

  it("status：远端不可达时降级 degraded 快照", async () => {
    process.env.FT_STUB = undefined;
    const { getLatestFinetuneJob } = await import("./finetune.repo");
    vi.mocked(getLatestFinetuneJob).mockResolvedValueOnce({
      id: "row-1", remoteJobId: "ftjob-real-1", remoteFileId: "file-1", baseModel: "glm-4-flash",
      sampleCount: 500, status: "running", fineTunedModel: null, error: null, createdAt: "t", updatedAt: "t",
    });
    const svc = mkSvc();
    const s = await svc.status();
    expect(s.latest?.degraded).toBe(true);
    expect(s.latest?.status).toBe("running");
  });
});
