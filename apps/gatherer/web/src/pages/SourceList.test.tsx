import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SourceList from "./SourceList";

afterEach(() => vi.unstubAllGlobals());

describe("SourceList", () => {
  it("渲染源列表与类型标签", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { id: "s1", name: "行业资讯", type: "rss", url: "https://x", cron: "", options: {}, status: "active", lastRunAt: null },
          ]),
          { status: 200 }
        )
      )
    );
    render(
      <MemoryRouter>
        <SourceList />
      </MemoryRouter>
    );
    expect(await screen.findByText("行业资讯")).toBeTruthy();
    expect(screen.getByText("RSS")).toBeTruthy();
  });
});
