import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("前台路由渲染极简对话外壳", async () => {
    window.history.pushState({}, "", "/assistant/chat");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    );
    render(<App />);
    expect(await screen.findByText("有问题，就直接问")).toBeTruthy();
    expect(screen.getByPlaceholderText("输入消息")).toBeTruthy();
    expect(screen.queryByText("ADMIN CONSOLE")).toBeNull();
  });

  it("后台路由渲染控制台外壳", () => {
    window.history.pushState({}, "", "/assistant/admin/feedback");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    );
    render(<App />);
    expect(screen.getByText("ADMIN CONSOLE")).toBeTruthy();
  });
});
