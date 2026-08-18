import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("渲染标题并显示服务状态 up", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    render(<App />);
    expect(screen.getByText("scholar")).toBeTruthy();
    expect(await screen.findByText(/服务状态: up/)).toBeTruthy();
  });
});
