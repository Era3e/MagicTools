import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RequestList from "./RequestList";

afterEach(() => vi.unstubAllGlobals());

describe("RequestList", () => {
  it("渲染请求列表与状态标签", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { id: "r1", surveyName: "满意度调研", sourceEventIds: ["e1"], status: "draft", contextText: "", repoUrl: "", repoContext: null, analysisMd: null, designMd: null, reviewComment: "", pushedAt: null, updatedAt: "2026-08-19T00:00:00Z" },
          ]),
          { status: 200 }
        )
      )
    );
    render(
      <MemoryRouter>
        <RequestList />
      </MemoryRouter>
    );
    expect(await screen.findByText("满意度调研")).toBeTruthy();
    expect(screen.getByText("草稿")).toBeTruthy();
  });
});
