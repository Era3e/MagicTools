import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("默认路由渲染前台岗位墙", async () => {
    window.history.pushState({}, "", "/applicant/positions");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(await screen.findByText("尚无岗位在册——去后台录入第一条机会吧。")).toBeTruthy();
  });

  it("后台路由渲染控制台外壳与岗位管理", async () => {
    window.history.pushState({}, "", "/applicant/admin/positions");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(await screen.findByText("岗位列表")).toBeTruthy();
    expect(screen.getByText("ADMIN CONSOLE")).toBeTruthy();
  });
});
