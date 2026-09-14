import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BadcasePage from "./BadcasePage";

describe("BadcasePage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (String(url).includes("/api/assistant/badcases") && method === "GET") {
        return new Response(JSON.stringify([{
          id: "b1", source: "user_clarify", stage: "routing", status: "new",
          title: "导出需求误路由", description: "", severity: "high",
          evidence: { message: "帮我创建需求" }, expected: null,
          traceId: "t1", conversationId: "c1", intentLogId: "i1", feedbackId: null,
          evaluationCaseId: null, baselineRunId: null, verificationRunId: null,
          requirementId: null, requirementUrl: "", fixPrUrl: "",
          createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
        }]), { status: 200 });
      }
      return new Response(JSON.stringify({ id: "b1", status: "classified" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("渲染 badcase 证据链并支持确认", async () => {
    render(<BadcasePage />);
    expect(await screen.findByText("导出需求误路由")).toBeTruthy();
    expect(await screen.findByText("user_clarify")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /确\s*认/ }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((item) => String(item[0]).includes("/badcases/b1/confirm"));
      expect(call).toBeTruthy();
    });
  });
});
