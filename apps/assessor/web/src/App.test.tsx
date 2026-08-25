import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("默认路由重定向到后台控制台", async () => {
    window.history.pushState({}, "", "/assessor/");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(await screen.findByText("ADMIN CONSOLE")).toBeTruthy();
  });

  it("后台路由渲染控制台外壳与分析请求审批", async () => {
    window.history.pushState({}, "", "/assessor/admin/requests");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(screen.getByText("ADMIN CONSOLE")).toBeTruthy();
    expect(await screen.findByText("分析请求")).toBeTruthy();
  });
});
