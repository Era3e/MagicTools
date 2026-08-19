import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SurveyList from "./SurveyList";

afterEach(() => vi.unstubAllGlobals());

describe("SurveyList", () => {
  it("渲染主题列表与飞书状态", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const u = String(url);
        if (u.includes("/meta/feishu-status")) return new Response(JSON.stringify({ configured: false }), { status: 200 });
        return new Response(
          JSON.stringify([
            { id: "s1", name: "满意度调研", description: "x", status: "active", source: "feishu_bitable", appToken: "", tableId: "", answerFields: [], summary: null, lastSyncedAt: null, updatedAt: "2026-08-19T00:00:00Z" },
          ]),
          { status: 200 }
        );
      })
    );
    render(
      <MemoryRouter>
        <SurveyList />
      </MemoryRouter>
    );
    expect(await screen.findByText("满意度调研")).toBeTruthy();
    expect(await screen.findByText("飞书未配置")).toBeTruthy();
  });
});
