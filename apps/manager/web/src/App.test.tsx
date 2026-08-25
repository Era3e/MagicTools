import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("前台路由渲染驾驶舱外壳与需求看板", async () => {
    window.history.pushState({}, "", "/manager/requirements");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(await screen.findByText("FLIGHT DECK · 需求在轨")).toBeTruthy();
    expect(screen.getByText("需求在轨，交付有期")).toBeTruthy();
    expect(screen.queryByText("ADMIN CONSOLE")).toBeNull();
  });

  it("前台看板渲染需求卡片", async () => {
    window.history.pushState({}, "", "/manager/requirements");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { id: "r1", title: "看板示例需求", description: "", source: "manual", sourceRef: "", sourcePayload: null, status: "developing", priority: "P1", iterationId: null, branch: "", prUrl: "", labels: [], timeline: [], updatedAt: "2026-01-01T00:00:00Z" },
          ]),
          { status: 200 }
        )
      )
    );
    render(<App />);
    expect(await screen.findByText("看板示例需求")).toBeTruthy();
  });

  it("后台路由渲染控制台外壳与迭代管理", async () => {
    window.history.pushState({}, "", "/manager/admin/iterations");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200 })));
    render(<App />);
    expect(screen.getByText("ADMIN CONSOLE")).toBeTruthy();
    expect(await screen.findByText("新建迭代")).toBeTruthy();
  });
});
