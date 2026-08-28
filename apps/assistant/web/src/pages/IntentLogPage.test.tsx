import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import IntentLogPage from "./IntentLogPage";

describe("IntentLogPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/api/assistant/intent-logs/evaluation")) {
        const emptyMatrix = Object.fromEntries(
          ["product_inquiry", "data_query", "chitchat_reject", "process_execution", "trouble_shooting", "complaint_feedback"].map((p) => [
            p,
            Object.fromEntries(
              ["product_inquiry", "data_query", "chitchat_reject", "process_execution", "trouble_shooting", "complaint_feedback"].map((a) => [a, 0])
            ),
          ])
        );
        return new Response(
          JSON.stringify({ confusion: { matrix: emptyMatrix, labels: [], total: 0, diagHits: 0 }, stats: [] }),
          { status: 200 }
        );
      }
      if (u.includes("/api/assistant/intent-logs/export/preview")) {
        return new Response(JSON.stringify({ count: 2, preview: [] }), { status: 200 });
      }
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

  it("D-09 渲染路由评估卡片与混淆矩阵空态", async () => {
    render(<IntentLogPage />);
    expect(await screen.findByText("路由评估（D-09 在线学习）")).toBeTruthy();
    expect(await screen.findByText(/暂无纠错样本/)).toBeTruthy();
    expect(screen.getByText(/纠错样本 0 条/)).toBeTruthy();
  });

  it("D-09 回放评估按钮请求 evaluation/replay 并展示命中率", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/evaluation/replay")) {
        return new Response(
          JSON.stringify({ total: 2, hits: 1, accuracy: 0.5, misses: [{ message: "查询数据", predicted: "product_inquiry", actual: "data_query" }] }),
          { status: 200 }
        );
      }
      if (u.includes("/evaluation")) {
        const m = { product_inquiry: { data_query: 1, product_inquiry: 0, chitchat_reject: 0, process_execution: 0, trouble_shooting: 0, complaint_feedback: 0 } };
        return new Response(JSON.stringify({ confusion: { matrix: m, labels: [], total: 1, diagHits: 0 }, stats: [{ intent: "product_inquiry", total: 1, corrected: 1 }] }), { status: 200 });
      }
      if (u.includes("/export/preview")) {
        return new Response(JSON.stringify({ count: 1, preview: [] }), { status: 200 });
      }
      if (u.includes("/intent-logs") && method === "GET") {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    render(<IntentLogPage />);
    fireEvent.click(await screen.findByRole("button", { name: /回放评估/ }));
    expect(await screen.findByText("50%")).toBeTruthy();
    expect(await screen.findByText("查询数据")).toBeTruthy();
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
