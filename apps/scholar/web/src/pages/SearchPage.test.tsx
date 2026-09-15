import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SearchPage from "./SearchPage";

describe("SearchPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/api/scholar/public/search") && init?.method === "POST") {
        return new Response(JSON.stringify({
          candidates: [{
            entryId: "e1",
            source: "manual",
            title: "提问并核对引用",
            category: "用户帮助",
            content: "引用包含版本、修订和证据区间",
            revisionId: "r1",
            revisionNo: 3,
            sourceRevision: "main@test",
            sourceUrl: "https://example.test/source",
            productVersion: "p20-1",
            deploymentRef: "registry@test",
            chunkNo: 1,
            charStart: 0,
            charEnd: 30,
            score: 0.95,
            channels: ["fts", "vector"],
            requirementLinks: [{ requirementId: "P20", requirementUrl: "", source: "manual" }],
          }],
        }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("按任务描述调用公共混合检索并展示证据", async () => {
    render(<SearchPage />);
    fireEvent.change(screen.getByPlaceholderText("输入任务或问题，例如：如何核对引用"), { target: { value: "如何核对引用" } });
    fireEvent.click(screen.getByRole("button", { name: /检\s*索/ }));
    expect(await screen.findByText("提问并核对引用")).toBeTruthy();
    expect(screen.getByText(/0\.95/)).toBeTruthy();
    expect(screen.getByText(/chunk 1 · 0-30/)).toBeTruthy();
    expect(screen.getByText(/版本 p20-1 · 修订 main@test/)).toBeTruthy();
    const post = fetchMock.mock.calls.find((call) => call[1] && (call[1] as RequestInit).method === "POST");
    expect(post).toBeTruthy();
    expect(String(post![0])).toContain("/public/search");
    expect(JSON.parse(String((post![1] as RequestInit).body)).q).toBe("如何核对引用");
  });
});
