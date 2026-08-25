import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("前台路由渲染书院外壳与馆藏条目", async () => {
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
    expect(screen.getByText("每一则知识，皆入馆藏")).toBeTruthy();
    expect(screen.queryByText("ADMIN CONSOLE")).toBeNull();
  });

  it("后台路由渲染控制台外壳", () => {
    window.history.pushState({}, "", "/scholar/admin/settings");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 }))
    );
    render(<App />);
    expect(screen.getByText("ADMIN CONSOLE")).toBeTruthy();
  });
});
