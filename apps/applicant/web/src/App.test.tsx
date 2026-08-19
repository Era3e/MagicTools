import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("默认路由渲染岗位列表页", async () => {
    // BrowserRouter basename 为 /applicant，jsdom 默认 URL 是 /，需先推到匹配路径
    window.history.pushState({}, "", "/applicant/positions");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(await screen.findByText("岗位列表")).toBeTruthy();
  });
});
