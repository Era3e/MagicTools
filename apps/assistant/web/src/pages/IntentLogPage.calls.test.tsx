import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import IntentLogPage from "./IntentLogPage";

function stubFetch(calls: unknown[]) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    if (u.includes("/api/assistant/meta/cybercloud-calls")) {
      return new Response(JSON.stringify(calls), { status: 200 });
    }
    if (u.includes("/api/assistant/intent-logs/evaluation")) {
      return new Response(
        JSON.stringify({ confusion: { matrix: {}, labels: [], total: 0, diagHits: 0 }, stats: [] }),
        { status: 200 }
      );
    }
    if (u.includes("/api/assistant/intent-logs") && method === "GET") {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });
}

describe("IntentLogPage 数据查询监控", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = stubFetch([
      {
        id: "c1",
        route: "agent",
        endpoint: "block",
        ok: true,
        latencyMs: 32000,
        error: null,
        detail: { verify_status: "divergent" },
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "c2",
        route: "direct",
        endpoint: "queryByStructure",
        ok: true,
        latencyMs: 1800,
        error: null,
        detail: {},
        createdAt: "2026-01-01T00:00:01Z",
      },
    ]);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("渲染卡片、双路记录与按路由分组的成功率/平均延迟", async () => {
    render(<IntentLogPage />);
    expect(await screen.findByText(/数据查询监控/)).toBeTruthy();
    expect(await screen.findByText(/queryByStructure/, {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.getByText(/block/)).toBeTruthy();
    expect(screen.getAllByText("agent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("direct").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/32000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1800/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("100%").length).toBe(2);
  });

  it("空列表渲染 MtEmptyState 空态与 -- 占位 KPI", async () => {
    fetchMock.mockImplementation(stubFetch([]));
    vi.stubGlobal("fetch", fetchMock);
    render(<IntentLogPage />);
    expect(await screen.findByText(/数据查询监控/)).toBeTruthy();
    expect(await screen.findByText(/暂无数据查询调用/)).toBeTruthy();
    expect(screen.getAllByText("EMPTY").length).toBe(1);
    expect(screen.getAllByText("--").length).toBe(4);
  });
});
