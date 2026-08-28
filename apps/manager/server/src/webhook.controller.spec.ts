/**
 * WebhookController 单元测试
 *
 * 测试策略：
 *   1. 签名校验失败 → 返回 signature_mismatch
 *   2. 非 pull_request 事件 → 返回 ignored
 *   3. 已处理的 delivery → 幂等返回 deduplicated
 *   4. 正常 PR merged → 状态迁移到 accepting + timeline 追加
 *   5. 状态回退防护（done 状态拒绝 webhook 回退）
 *   6. 找不到关联 requirement → 返回 no_match
 */
import { Test, TestingModule } from "@nestjs/testing";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookController } from "./webhook.controller";

// vi.mock 工厂被提升到文件顶部执行，必须用 vi.hoisted 把 mock 变量一起提升
const { mockPoolQuery, mockSetStatus, mockGetRequirement } = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
  mockSetStatus: vi.fn(),
  mockGetRequirement: vi.fn(),
}));

vi.mock("./db", () => ({
  pool: { query: mockPoolQuery },
}));

vi.mock("./requirement.repo", () => ({
  setStatusWithTimeline: mockSetStatus,
  getRequirement: mockGetRequirement,
}));

describe("WebhookController", () => {
  let controller: WebhookController;

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.GITHUB_STUB = "1"; // 桩模式跳过签名校验
    process.env.GITHUB_WEBHOOK_SECRET = "";

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
    }).compile();

    controller = module.get(WebhookController);
  });

  describe("POST /webhook/github", () => {
    const basePayload = {
      action: "merged",
      pull_request: {
        html_url: "https://github.com/owner/repo/pull/42",
        state: "closed" as const,
        merged: true,
        number: 42,
        title: "feat: something",
        base: { ref: "main" },
        head: { ref: "feat-branch", user: { login: "dev" } },
      },
      repository: { name: "repo" },
    };

    it("签名校验失败时返回 signature_mismatch", async () => {
      delete process.env.GITHUB_STUB;
      process.env.GITHUB_WEBHOOK_SECRET = "test-secret";

      // 构造错误签名
      const res = await controller.github(
        "sha256=wrong-signature",
        "pull_request",
        "delivery-001",
        Buffer.from("{}"),
        basePayload,
      );

      expect(res.ok).toBe(false);
      expect(res.action).toBe("signature_mismatch");
    });

    it("非 pull_request 事件返回 ignored", async () => {
      const res = await controller.github(
        undefined,
        "issues",
        "delivery-002",
        Buffer.from("{}"),
        { action: "opened", issue: {}, repository: { name: "repo" } },
      );

      expect(res.ok).toBe(true);
      expect(res.action).toBe("ignored");
    });

    it("幂等：相同 delivery 在 TTL 内再次请求返回 deduplicated", async () => {
      // 先让 findRequirementByPrUrl 返回 null（no_match）登记幂等
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await controller.github(
        undefined,
        "pull_request",
        "delivery-003",
        Buffer.from("{}"),
        basePayload,
      );

      // 第二次同一 delivery
      const res = await controller.github(
        undefined,
        "pull_request",
        "delivery-003",
        Buffer.from("{}"),
        basePayload,
      );

      expect(res.ok).toBe(true);
      expect(res.action).toBe("deduplicated");
    });

    it("PR merged → 状态迁移到 accepting + timeline 追加", async () => {
      // findRequirementByPrUrl 找到一条 developing 状态的 requirement
      mockPoolQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "req-1",
            title: "test req",
            description: "",
            source: "github",
            source_ref: "owner/repo#42",
            source_payload: null,
            status: "developing",
            priority: "P1",
            iteration_id: null,
            branch: "feat-x",
            pr_url: "https://github.com/owner/repo/pull/42",
            labels: [],
            timeline: [],
            created_at: "2026-08-01T00:00:00Z",
            updated_at: "2026-08-01T00:00:00Z",
          },
        ],
      });
      mockSetStatus.mockResolvedValueOnce({
        id: "req-1",
        status: "accepting",
      });

      const res = await controller.github(
        undefined,
        "pull_request",
        "delivery-004",
        Buffer.from("{}"),
        basePayload,
      );

      expect(res.ok).toBe(true);
      expect(res.action).toBe("status_updated");
      expect(res.status).toBe("accepting");
      expect(mockSetStatus).toHaveBeenCalledWith(
        "req-1",
        "accepting",
        "developing",
        expect.stringContaining("Webhook: PR merged"),
      );
    });

    it("done 状态拒绝回退", async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: "req-2",
            status: "done",
            pr_url: "https://github.com/owner/repo/pull/99",
            title: "done req",
            description: "",
            source: "github",
            source_ref: "owner/repo#99",
            source_payload: null,
            priority: "P1",
            iteration_id: null,
            branch: "",
            labels: [],
            timeline: [],
            created_at: "2026-08-01T00:00:00Z",
            updated_at: "2026-08-01T00:00:00Z",
          },
        ],
      });

      const res = await controller.github(
        undefined,
        "pull_request",
        "delivery-005",
        Buffer.from("{}"),
        { ...basePayload, pull_request: { ...basePayload.pull_request, number: 99, merged: true } },
      );

      expect(res.action).toBe("skipped");
      expect(res.reason).toContain("cannot regress");
    });

    it("找不到关联 requirement 返回 no_match", async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const res = await controller.github(
        undefined,
        "pull_request",
        "delivery-006",
        Buffer.from("{}"),
        basePayload,
      );

      expect(res.ok).toBe(true);
      expect(res.action).toBe("no_match");
      expect(res.reason).toContain("no requirement linked");
    });
  });
});
