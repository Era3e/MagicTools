import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("默认路由重定向到后台控制台", async () => {
    window.history.pushState({}, "", "/gatherer/");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(await screen.findByText("GATHERER · CONTROL")).toBeTruthy();
  });

  it("后台路由渲染控制台外壳与信息源管理", async () => {
    window.history.pushState({}, "", "/gatherer/admin/sources");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(screen.getByText("GATHERER · CONTROL")).toBeTruthy();
    expect(await screen.findByText("新增采集源")).toBeTruthy();
  });
});
