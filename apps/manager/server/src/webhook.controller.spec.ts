import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebhookController } from "./webhook.controller";

const { mockClaim, mockFinish, mockApply } = vi.hoisted(() => ({
  mockClaim: vi.fn(),
  mockFinish: vi.fn(),
  mockApply: vi.fn(),
}));

vi.mock("./webhook.repo", () => ({
  claimGithubDelivery: mockClaim,
  finishGithubDelivery: mockFinish,
  applyGithubPrState: mockApply,
}));

describe("WebhookController", () => {
  const basePayload = {
    action: "closed",
    pull_request: {
      html_url: "https://github.com/owner/repo/pull/42",
      state: "closed" as const,
      merged: true,
      number: 42,
      title: "feat: something",
      updated_at: "2026-09-14T10:00:00Z",
      base: { ref: "main" },
      head: { ref: "feature", user: { login: "dev" } },
    },
    repository: { name: "repo" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_STUB = "1";
    process.env.GITHUB_WEBHOOK_SECRET = "";
    delete process.env.NODE_ENV;
    delete process.env.MT_PROD;
    mockClaim.mockResolvedValue("lock-owner");
    mockFinish.mockResolvedValue(undefined);
    mockApply.mockResolvedValue({ outcome: "status_updated", id: "req-1", status: "accepting" });
  });

  it("签名不匹配时拒绝", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = "secret";
    delete process.env.GITHUB_STUB;
    const result = await new WebhookController().github(
      "sha256=wrong", "pull_request", "delivery-signature", Buffer.from("{}"), basePayload,
    );
    expect(result).toMatchObject({ ok: false, action: "signature_mismatch" });
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it("开启签名时缺少原始请求体直接拒绝", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = "secret";
    delete process.env.GITHUB_STUB;
    const result = await new WebhookController().github(
      "sha256=" + "0".repeat(64), "pull_request", "delivery-missing-raw", undefined, basePayload,
    );
    expect(result).toMatchObject({ ok: false, action: "signature_mismatch", reason: "raw body required" });
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it("生产缺secret或开启桩模式时拒绝", async () => {
    process.env.NODE_ENV = "production";
    process.env.GITHUB_WEBHOOK_SECRET = "";
    process.env.GITHUB_STUB = "1";
    const missingSecret = await new WebhookController().github(
      undefined, "pull_request", "delivery-prod-missing", Buffer.from("{}"), basePayload,
    );
    expect(missingSecret).toMatchObject({ ok: false, action: "signature_required" });

    process.env.GITHUB_WEBHOOK_SECRET = "secret";
    const stubBypass = await new WebhookController().github(
      undefined, "pull_request", "delivery-prod-stub", Buffer.from("{}"), basePayload,
    );
    expect(stubBypass).toMatchObject({ ok: false, action: "signature_required" });
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it("非生产环境未配置secret且未显式桩模式时拒绝", async () => {
    process.env.NODE_ENV = "development";
    process.env.GITHUB_WEBHOOK_SECRET = "";
    delete process.env.GITHUB_STUB;
    const result = await new WebhookController().github(
      undefined, "pull_request", "delivery-dev-missing-secret", Buffer.from("{}"), basePayload,
    );
    expect(result).toMatchObject({ ok: false, action: "signature_required" });
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it("非pull_request事件忽略", async () => {
    const result = await new WebhookController().github(
      undefined, "issues", "delivery-issue", Buffer.from("{}"), { action: "opened", issue: {} },
    );
    expect(result).toMatchObject({ ok: true, action: "ignored" });
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it("同一delivery重复投递时持久去重", async () => {
    mockClaim.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const controller = new WebhookController();
    const first = await controller.github(undefined, "pull_request", "delivery-dedupe", Buffer.from("{}"), basePayload);
    const second = await controller.github(undefined, "pull_request", "delivery-dedupe", Buffer.from("{}"), basePayload);
    expect(first).toMatchObject({ ok: true, action: "status_updated" });
    expect(second).toMatchObject({ ok: true, action: "deduplicated" });
    expect(mockApply).toHaveBeenCalledTimes(1);
  });

  it("回执绑定领取租约的持有者", async () => {
    mockClaim.mockResolvedValueOnce("lock-owner");
    const result = await new WebhookController().github(
      undefined, "pull_request", "delivery-lock-owner", Buffer.from("{}"), basePayload,
    );
    expect(result).toMatchObject({ ok: true, action: "status_updated" });
    expect(mockFinish).toHaveBeenNthCalledWith(1, "delivery-lock-owner", "lock-owner", "done");
  });

  it("正确HMAC签名通过并应用状态", async () => {
    delete process.env.GITHUB_STUB;
    process.env.GITHUB_WEBHOOK_SECRET = "secret";
    const raw = Buffer.from(JSON.stringify(basePayload));
    const signature = "sha256=" + createHmac("sha256", "secret").update(raw).digest("hex");
    const result = await new WebhookController().github(signature, "pull_request", "delivery-valid", raw, basePayload);
    expect(result).toMatchObject({ ok: true, action: "status_updated", status: "accepting" });
    expect(mockApply).toHaveBeenCalledWith(expect.objectContaining({ targetStatus: "accepting" }));
  });

  it("状态回退保护返回skipped", async () => {
    mockApply.mockResolvedValueOnce({
      outcome: "transition_not_allowed", id: "req-done", from: "done", to: "accepting",
    });
    const result = await new WebhookController().github(undefined, "pull_request", "delivery-done", Buffer.from("{}"), basePayload);
    expect(result).toMatchObject({ ok: true, action: "skipped", reason: "transition done→accepting not allowed" });
    expect(mockFinish).toHaveBeenCalledWith("delivery-done", "lock-owner", "done");
  });

  it("未关联需求返回no_match", async () => {
    mockApply.mockResolvedValueOnce({ outcome: "no_match" });
    const result = await new WebhookController().github(undefined, "pull_request", "delivery-no-match", Buffer.from("{}"), basePayload);
    expect(result).toMatchObject({ ok: true, action: "no_match" });
  });
});
