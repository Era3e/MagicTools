import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("前台路由渲染驾驶舱外壳与需求台", async () => {
    window.history.pushState({}, "", "/manager/requirements");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(await screen.findByText("需求管理")).toBeTruthy();
    expect(screen.getByText("需求在轨，交付有期")).toBeTruthy();
    expect(screen.queryByText("ADMIN CONSOLE")).toBeNull();
  });

  it("后台路由渲染控制台外壳与迭代管理", async () => {
    window.history.pushState({}, "", "/manager/admin/iterations");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(screen.getByText("ADMIN CONSOLE")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "迭代管理" })).toBeTruthy();
  });
});
