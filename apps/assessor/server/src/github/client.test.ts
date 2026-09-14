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

  it("仓库目录超过200个文件时返回完整清单且拒绝API截断", async () => {
    const tree = Array.from({ length: 201 }, (_, index) => ({
      path: `packages/module-${index}/src/index.ts`,
      type: "blob",
    }));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      truncated: false,
      tree,
    }), { status: 200 })));
    const client = new GitHubClient({ token: "" });

    const ctx = await client.getRepoContext("owner/repo");

    expect(ctx.tree).toHaveLength(201);
    expect(ctx.tree[200]).toBe("packages/module-200/src/index.ts");
  });

  it("仓库目录被GitHub API截断时显式失败", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      truncated: true,
      tree: [{ path: "src/index.ts", type: "blob" }],
    }), { status: 200 })));
    const client = new GitHubClient({ token: "" });

    await expect(client.getRepoContext("owner/repo")).rejects.toThrow(/目录被截断/);
  });

  it("按提交读取变更清单且拒绝超过200个文件", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("/commits/")) {
        return new Response(JSON.stringify({
          sha: "a".repeat(40),
          commit: { message: "feat: add export" },
          truncated: false,
          files: Array.from({ length: 201 }, (_, index) => ({
            filename: `apps/demo/src/file-${index}.ts`,
            status: "modified",
            patch: "@@ -1,2 +1,3 @@\n+new line",
          })),
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ default_branch: "main" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new GitHubClient({ token: "" });

    await expect(client.getCommitSnapshot("owner/repo", "a".repeat(40)))
      .rejects.toThrow(/变更文件超过200/);
  });

  it("按提交读取指定文件内容", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      content: Buffer.from("export const value = 1;").toString("base64"),
      encoding: "base64",
    }), { status: 200 })));
    const client = new GitHubClient({ token: "" });

    const content = await client.getFileContent("owner/repo", "a".repeat(40), "src/value.ts");

    expect(content).toBe("export const value = 1;");
  });
});
