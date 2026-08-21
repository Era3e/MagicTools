import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import IntentLogPage from "./IntentLogPage";

describe("IntentLogPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/api/assistant/intent-logs") && method === "GET") {
        return new Response(
          JSON.stringify([
            {
              id: "l1",
              message: "帮我创建一个订单业务对象",
              domain: "cybercloud",
              intent: "data_query",
              confidence: 1,
              correctedIntent: null,
              createdAt: "2026-01-01T00:00:00Z",
            },
          ]),
          { status: 200 }
        );
      }
      if (u.includes("/api/assistant/intent-logs") && method === "POST") {
        return new Response(
          JSON.stringify({ id: "l1", message: "x", domain: "cybercloud", intent: "data_query", confidence: 1, correctedIntent: "process_execution", createdAt: "2026-01-01T00:00:00Z" }),
          { status: 201 }
        );
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("渲染意图日志列表（domain/intent/置信度）", async () => {
    render(<IntentLogPage />);
    expect(await screen.findByText("帮我创建一个订单业务对象")).toBeTruthy();
    expect(screen.getByText("cybercloud")).toBeTruthy();
    expect(screen.getByText("data_query")).toBeTruthy();
  });

  it("纠错弹窗提交 POST /intent-logs/:id/correct", async () => {
    render(<IntentLogPage />);
    fireEvent.click(await screen.findByRole("button", { name: /纠\s*错/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.mouseDown(within(dialog).getByRole("combobox"));
    fireEvent.click(await screen.findByText(/process_execution/));
    fireEvent.click(screen.getByRole("button", { name: /确\s*定/ }));
    await waitFor(() => {
      const post = fetchMock.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === "POST");
      expect(post).toBeTruthy();
      expect(String(post![0])).toContain("/api/assistant/intent-logs/l1/correct");
      const body = JSON.parse(String((post![1] as RequestInit).body));
      expect(body.correctedIntent).toBe("process_execution");
    });
  });
});
