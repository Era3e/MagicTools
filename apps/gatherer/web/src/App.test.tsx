import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("默认路由渲染信息源页", async () => {
    window.history.pushState({}, "", "/gatherer/sources");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(await screen.findByText("新建源")).toBeTruthy();
  });
});
