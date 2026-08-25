import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("前台路由渲染画廊外壳与定制生成", async () => {
    window.history.pushState({}, "", "/designer/generate");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    );
    render(<App />);
    expect(await screen.findByText(/定制生成/)).toBeTruthy();
    expect(screen.getByText("描述你的想象，取走你的组件")).toBeTruthy();
    expect(screen.queryByText("ADMIN CONSOLE")).toBeNull();
  });

  it("后台路由渲染控制台外壳与组件馆藏", async () => {
    window.history.pushState({}, "", "/designer/admin/components");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    );
    render(<App />);
    expect(screen.getByText("ADMIN CONSOLE")).toBeTruthy();
  });
});
