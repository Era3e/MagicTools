import { describe, it, expect, vi, afterEach } from "vitest";
import { GitHubClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("GitHubClient", () => {
  it("解析 owner/repo 并拉取 README 与目录树", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/readme")) {
        return new Response(JSON.stringify({ content: Buffer.from("# 示例项目").toString("base64") }), { status: 200 });
      }
      if (u.includes("/git/trees")) {
        return new Response(JSON.stringify({ truncated: false, tree: [{ path: "src/index.ts", type: "blob" }, { path: "README.md", type: "blob" }] }), { status: 200 });
      }
      if (u.includes("/languages")) {
        return new Response(JSON.stringify({ TypeScript: 80, CSS: 20 }), { status: 200 });
      }
      return new Response(JSON.stringify({ default_branch: "main" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const c = new GitHubClient({ token: "" });
    const ctx = await c.getRepoContext("Era3e/MagicTools");
    expect(ctx.readme).toContain("示例项目");
    expect(ctx.tree).toContain("src/index.ts");
    expect(ctx.languages).toEqual(["TypeScript", "CSS"]);
    expect(ctx.defaultBranch).toBe("main");
  });

  it("非法仓库名抛错", async () => {
    const c = new GitHubClient({ token: "" });
    await expect(c.getRepoContext("bad-format")).rejects.toThrow(/owner\/repo/);
  });

  it("桩模式返回固定上下文", async () => {
    const c = new GitHubClient({ token: "" });
    c.setStub(true);
    const ctx = await c.getRepoContext("any/repo");
    expect(ctx.readme.length).toBeGreaterThan(0);
    expect(ctx.tree.length).toBeGreaterThan(0);
  });
});
