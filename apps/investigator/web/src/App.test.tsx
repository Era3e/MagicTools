import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("默认路由渲染调研主题页", async () => {
    window.history.pushState({}, "", "/investigator/surveys");
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("/meta/feishu-status")) return new Response(JSON.stringify({ configured: false }), { status: 200 });
      return new Response("[]", { status: 200 });
    }));
    render(<App />);
    expect(await screen.findByText("调研主题")).toBeTruthy();
  });
});
