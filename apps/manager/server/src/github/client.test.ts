import { describe, it, expect, vi, afterEach } from "vitest";
import { GitHubClient } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("GitHubClient", () => {
  it("拉取 issues 列表并规范化", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([
        { number: 1, title: "需求A", body: "描述", state: "open", labels: [{ name: "bug" }], html_url: "https://github.com/x/y/issues/1" },
      ]), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const c = new GitHubClient({ token: "" });
    const issues = await c.listIssues("Era3e/MagicTools");
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toBe("需求A");
    expect(issues[0].labels).toEqual(["bug"]);
  });

  it("查询 PR 状态", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ state: "open", merged: false, html_url: "u" }), { status: 200 })));
    const c = new GitHubClient({ token: "" });
    const pr = await c.getPr("Era3e/MagicTools", 3);
    expect(pr.state).toBe("open");
    expect(pr.merged).toBe(false);
  });

  it("非法仓库名抛错", async () => {
    const c = new GitHubClient({ token: "" });
    await expect(c.listIssues("bad")).rejects.toThrow(/owner\/repo/);
  });

  it("桩模式返回固定数据", async () => {
    const c = new GitHubClient({ token: "" });
    c.setStub(true);
    const issues = await c.listIssues("any/repo");
    expect(issues.length).toBeGreaterThan(0);
    const pr = await c.getPr("any/repo", 1);
    expect(pr.state).toBeTruthy();
  });
});
