import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CodeIndexPage from "./CodeIndexPage";

describe("CodeIndexPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("检索开发问题并展示代码来源证据", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("/api/scholar/")) return response([hit("D01", "系统由哪些边界组成？", "docs/code-wiki/overview.md")]);
      return response([]);
    }));
    render(<CodeIndexPage />);
    expect(await screen.findByText("系统由哪些边界组成？")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/系统边界/), { target: { value: "边界" } });
    fireEvent.click(screen.getByRole("button", { name: /检\s*索/ }));
    expect(await screen.findByText("系统由哪些边界组成？")).toBeTruthy();
    expect(screen.getByRole("link", { name: /来源证据/ }).getAttribute("href")).toBe("https://example.com/code");
    expect(screen.getByText(/需求 P20/)).toBeTruthy();
  });
});

function hit(id: string, title: string, content: string) {
  return {
    id,
    source: "manual",
    sourceRef: "P20-" + id,
    title,
    content,
    summary: title,
    category: "开发导航",
    tags: ["开发知识"],
    assistantScope: false,
    spaceKey: "development",
    spaceKind: "development",
    status: "draft",
    currentRevisionId: "revision-" + id,
    revisionNo: 1,
    sourceRevision: "main@abc",
    sourceUrl: "https://example.com/code",
    requirementId: "P20",
    requirementUrl: "",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    score: 1,
  };
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
