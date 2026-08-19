import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequirementList from "./RequirementList";

afterEach(() => vi.unstubAllGlobals());

describe("RequirementList", () => {
  it("渲染需求列表与状态标签", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { id: "r1", title: "批量导出需求", description: "", source: "assessor", sourceRef: "", sourcePayload: null, status: "waiting", priority: "P1", iterationId: null, branch: "", prUrl: "", labels: ["assessor"], timeline: [], updatedAt: "2026-08-19T00:00:00Z" },
          ]),
          { status: 200 }
        )
      )
    );
    render(
      <MemoryRouter>
        <RequirementList />
      </MemoryRouter>
    );
    expect(await screen.findByText("批量导出需求")).toBeTruthy();
    expect(screen.getByText("待分析")).toBeTruthy();
    expect(screen.getByText("Assessor")).toBeTruthy();
  });
});
