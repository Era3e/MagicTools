import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("导航到聊天页并渲染助手界面", async () => {
    window.history.pushState({}, "", "/assistant/chat");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    );
    render(<App />);
    expect(await screen.findByText("智能助手")).toBeTruthy();
    expect(screen.getByPlaceholderText("输入消息")).toBeTruthy();
  });
});
