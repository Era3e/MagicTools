import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FeedbackPage from "./FeedbackPage";

describe("FeedbackPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/api/assistant/feedback") && method === "GET") {
        return new Response(
          JSON.stringify([{ id: "f1", content: "搜索功能不好用", contact: "", createdAt: "2026-01-01T00:00:00Z" }]),
          { status: 200 }
        );
      }
      if (u.includes("/api/assistant/feedback") && method === "DELETE") {
        return new Response(JSON.stringify({ deleted: true }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("渲染反馈列表", async () => {
    render(<FeedbackPage />);
    expect(await screen.findByText("搜索功能不好用")).toBeTruthy();
  });

  it("删除反馈调用 DELETE", async () => {
    render(<FeedbackPage />);
    fireEvent.click(await screen.findByRole("button", { name: /删\s*除/ }));
    await waitFor(() => {
      const del = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "DELETE");
      expect(del).toBeTruthy();
      expect(String(del![0])).toContain("/api/assistant/feedback/f1");
    });
  });
});
