import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HelpPage from "./HelpPage";

describe("HelpPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("只展示当前发布版本中的用户任务", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("/public/version/current")) {
        return response({ version: "20.0.0", sourceRevision: "main@abc", deploymentRef: "registry@sha256:def" });
      }
      if (String(url).includes("/public/entries")) {
        return response([
          publicEntry("P20-U01", "登录并进入授权应用", "目标与入口：打开系统"),
          publicEntry("P20-U02", "分析简历", "目标与入口：进入简历工坊"),
        ]);
      }
      return response({});
    }));
    render(<HelpPage />);
    expect(await screen.findByText("登录并进入授权应用")).toBeTruthy();
    expect(screen.getByText(/版本 20\.0\.0/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(/简历/), { target: { value: "简历" } });
    expect(screen.getByText("分析简历")).toBeTruthy();
    expect(screen.queryByText("登录并进入授权应用")).toBeNull();
  });
});

function publicEntry(id: string, title: string, content: string) {
  return {
    id,
    source: "manual",
    sourceRef: id,
    title,
    content,
    summary: title,
    category: "用户帮助",
    tags: ["P20"],
    assistantScope: false,
    spaceKey: "product",
    spaceKind: "product",
    status: "published",
    currentRevisionId: "revision-" + id,
    revisionNo: 1,
    sourceRevision: "main@abc",
    sourceUrl: "https://example.com/source",
    requirementId: "P20",
    requirementUrl: "",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    productVersion: "20.0.0",
    productVersionId: "version-id",
    deploymentRef: "registry@sha256:def",
    requirementLinks: [{ requirementId: "P20", requirementUrl: "", source: "manual" }],
  };
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
