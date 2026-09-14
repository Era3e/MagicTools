import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SourceList from "./SourceList";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SourceList", () => {
  it("渲染源列表与类型标签", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/meta/scheduler-status")) {
          return new Response(JSON.stringify({ tasks: [] }), { status: 200 });
        }
        if (url.endsWith("/meta/dead-letters")) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response(
          JSON.stringify([
            { id: "s1", name: "行业资讯", type: "rss", url: "https://x", cron: "", options: {}, status: "active", lastRunAt: null },
          ]),
          { status: 200 }
        );
      })
    );
    render(
      <MemoryRouter>
        <SourceList />
      </MemoryRouter>
    );
    expect(await screen.findByText("行业资讯")).toBeTruthy();
    expect(screen.getAllByText("RSS").length).toBeGreaterThanOrEqual(1);
  });

  it("渲染调度实况与死信追踪", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/meta/scheduler-status")) {
          return new Response(JSON.stringify({
            tasks: [
              { sourceId: "s1", name: "行业资讯", cron: "0 * * * *", registered: true, lastRunAt: "2026-09-14T00:00:00.000Z", lastRunStatus: "success", lastRunFetchedCount: 8, lastRunNewCount: 3, lastRunError: null },
            ],
          }), { status: 200 });
        }
        if (url.endsWith("/meta/dead-letters")) {
          return new Response(JSON.stringify([
            { id: "dead-1", sourceId: "s1", runId: "run-1", error: "stub feed unavailable", status: "pending", attempts: 0, occurredAt: "2026-09-14T00:01:00.000Z" },
          ]), { status: 200 });
        }
        return new Response(JSON.stringify([]), { status: 200 });
      })
    );
    render(
      <MemoryRouter>
        <SourceList />
      </MemoryRouter>
    );
    expect(await screen.findByText("调度实况")).toBeTruthy();
    expect(await screen.findByText("已注册")).toBeTruthy();
    expect(await screen.findByText("8 / 3")).toBeTruthy();
    expect(await screen.findByText("stub feed unavailable")).toBeTruthy();
    expect(await screen.findByText("pending · 0次")).toBeTruthy();
  });
});
