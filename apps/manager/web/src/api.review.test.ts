import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => { vi.unstubAllGlobals(); });

describe("P08 审批 API 传输独立验收", () => {
  it.each(["approveRevision", "revokeApproval"] as const)("%s 同时传递 JSON 类型与独立凭证头，不把凭证写入 body", async (method) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "review-a" }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const input = { expectedRevision: 8, expectedContentRevision: 3, reason: "人工确认" };
    await api[method]("review-a", input, "test-review-credential");
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/manager/requirements/review-a/" + (method === "approveRevision" ? "approve-revision" : "revoke-approval"));
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(new Headers(init.headers).get("x-manager-approval-token")).toBe("test-review-credential");
    expect(JSON.parse(String(init.body))).toEqual(input);
  });

  it("冲突保留 HTTP 状态供弹窗失效处理，非 JSON 错误仍提供友好信息", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ message: "版本冲突" }), { status: 409 }))
      .mockResolvedValueOnce(new Response("proxy limit", { status: 413 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(api.approveRevision("review-a", { expectedRevision: 8, expectedContentRevision: 3, reason: "" }, "test-only"))
      .rejects.toMatchObject({ status: 409, message: "版本冲突" });
    await expect(api.patchRequirement("review-a", { description: "large" })).rejects.toMatchObject({ status: 413, message: "内容过大，请缩短后重试" });
  });
});
