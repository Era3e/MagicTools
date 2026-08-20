import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("导航到生成页并渲染表单", async () => {
    window.history.pushState({}, "", "/designer/generate");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))
    );
    render(<App />);
    expect(await screen.findByText("组件生成")).toBeTruthy();
    expect(screen.getByPlaceholderText("描述你要生成的组件，例如：一个带统计数字的卡片")).toBeTruthy();
  });
});
