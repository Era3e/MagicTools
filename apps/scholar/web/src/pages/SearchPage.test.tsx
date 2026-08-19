import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SearchPage from "./SearchPage";

describe("SearchPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/api/scholar/entries/search")) {
        return new Response(
          JSON.stringify([
            {
              id: "e1",
              source: "manual",
              sourceRef: null,
              title: "苹果公司发布新手机",
              content: "",
              summary: "",
              category: "",
              tags: [],
              assistantScope: false,
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
              score: 0.95,
            },
          ]),
          { status: 200 }
        );
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("按关键词检索并展示结果与相似度", async () => {
    render(<SearchPage />);
    fireEvent.change(screen.getByPlaceholderText("输入关键词"), { target: { value: "苹果" } });
    fireEvent.click(screen.getByRole("button", { name: /搜\s*索/ }));
    expect(await screen.findByText("苹果公司发布新手机")).toBeTruthy();
    expect(screen.getByText(/0\.95/)).toBeTruthy();
    const called = fetchMock.mock.calls.map((c) => String(c[0])).find((u) => u.includes("/entries/search"));
    expect(called).toContain("q=" + encodeURIComponent("苹果"));
    expect(called).toContain("mode=fts");
  });
});
