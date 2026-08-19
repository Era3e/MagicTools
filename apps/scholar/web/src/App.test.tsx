import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("导航到条目页并渲染条目列表", async () => {
    window.history.pushState({}, "", "/scholar/entries");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/scholar/entries")) {
          return new Response(
            JSON.stringify([
              {
                id: "e1",
                source: "manual",
                sourceRef: null,
                title: "测试条目",
                content: "",
                summary: "",
                category: "",
                tags: [],
                assistantScope: false,
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
              },
            ]),
            { status: 200 }
          );
        }
        return new Response("{}", { status: 200 });
      })
    );
    render(<App />);
    expect(await screen.findByText("测试条目")).toBeTruthy();
  });
});
