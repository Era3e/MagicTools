/**
 * D-04 PublishController + PublishService 单元测试
 *
 * 覆盖场景：
 *   1. 组件不存在 → 404
 *   2. 组件代码为空 → 400
 *   3. 组件名含非法字符 → 400
 *   4. 正常发布（桩模式）→ 返回 PR 信息
 *   5. 正常发布（真实模式，mock fetch）→ 完整流程
 *   6. GitHub API 分支创建失败 → 500
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PublishService } from "./publish.service";
import { getComponent } from "./component.repo";
import { GitHubClient } from "./github/client";

// vi.hoisted 确保 mock 变量在 vi.mock 工厂之前初始化
const {
  mockGetComponent,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetComponent: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("./component.repo", () => ({
  getComponent: mockGetComponent,
}));

vi.stubGlobal("fetch", mockFetch);

describe("PublishService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 确保 getComponent 被引用（实际通过 vi.mock 替换为 mockGetComponent）
    void getComponent;
  });

  it("组件不存在 → 抛出 NotFoundException", async () => {
    mockGetComponent.mockResolvedValueOnce(null);
    const svc = new PublishService();
    await expect(svc.publish("nonexistent")).rejects.toThrow(/组件不存在/);
  });

  it("组件代码为空 → 抛出 BadRequestException", async () => {
    mockGetComponent.mockResolvedValueOnce({
      id: "c1", name: "TestComp", description: "", code: "  ", createdAt: "",
    });
    const svc = new PublishService();
    await expect(svc.publish("c1")).rejects.toThrow(/代码为空/);
  });

  it("组件名含非法字符 → 抛出 BadRequestException", async () => {
    mockGetComponent.mockResolvedValueOnce({
      id: "c1", name: "123Bad!", description: "", code: "const x=1;", createdAt: "",
    });
    const svc = new PublishService();
    await expect(svc.publish("c1")).rejects.toThrow(/字母、数字、下划线/);
  });

  it("桩模式发布 → 返回 PR 信息", async () => {
    mockGetComponent.mockResolvedValueOnce({
      id: "c1", name: "MyButton", description: "按钮组件", code: "export const MyButton = () => <button/>;", createdAt: "",
    });

    const svc = new PublishService();
    // 强制桩模式
    const github = svc["github"] as GitHubClient;
    github.setStub(true);

    const result = await svc.publish("c1");
    expect(result.ok).toBe(true);
    expect(result.prNumber).toBeGreaterThan(0);
    expect(result.prUrl).toContain("/pull/");
    expect(result.branch).toContain("designer/publish-mybutton-");
    expect(result.targetPath).toBe("packages/ui/src/patterns/MyButton.tsx");
  });

  it("真实模式发布 → 完整流程（mock fetch）", async () => {
    mockGetComponent.mockResolvedValueOnce({
      id: "c1", name: "CardList", description: "卡片列表", code: "export const CardList = () => null;", createdAt: "",
    });

    // Mock GitHub API 调用序列：
    // 1. GET /git/ref/heads/main → 返回 base sha
    // 2. POST /git/refs → 创建分支
    // 3. PUT /contents/patterns/CardList.tsx → 写文件
    // 4. GET /contents/index.ts → 返回现有内容 + sha
    // 5. PUT /contents/index.ts → 更新 export
    // 6. POST /pulls → 创建 PR
    const responses = [
      // getBranchSha
      jsonRes(200, { object: { sha: "base-sha-123" } }),
      // createBranch
      jsonRes(201, { ref: "refs/heads/designer/publish-cardlist-1", sha: "new-sha-1", url: "u" }),
      // createOrUpdateFile (CardList.tsx)
      jsonRes(201, { sha: "file-sha-1", url: "u", content: { sha: "c1" } }),
      // GET index.ts (更新 export)
      jsonRes(200, { sha: "idx-sha-1", content: Buffer.from("export { X } from './patterns/X';\n").toString("base64") }),
      // createOrUpdateFile (index.ts)
      jsonRes(200, { sha: "idx-sha-2", url: "u", content: { sha: "c2" } }),
      // createPr
      jsonRes(201, { number: 99, html_url: "https://github.com/owner/repo/pull/99", url: "https://github.com/owner/repo/pull/99" }),
    ];
    mockFetch.mockImplementation(() => responses.shift()!);

    const svc = new PublishService();
    const github = svc["github"] as GitHubClient;
    github.setStub(false); // 确保不走桩模式

    const result = await svc.publish("c1");
    expect(result.ok).toBe(true);
    expect(result.prNumber).toBe(99);
    expect(result.prUrl).toContain("/pull/99");
    expect(result.branch).toContain("designer/publish-cardlist-");

    // 验证 fetch 被调用了 6 次
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it("GitHub API 分支创建失败 → 抛异常", async () => {
    mockGetComponent.mockResolvedValueOnce({
      id: "c1", name: "FailComp", description: "", code: "x", createdAt: "",
    });

    const responses = [
      // getBranchSha
      jsonRes(200, { object: { sha: "base-sha" } }),
      // createBranch → 失败
      jsonRes(403, { message: "Forbidden" }),
    ];
    mockFetch.mockImplementation(() => responses.shift()!);

    const svc = new PublishService();
    const github = svc["github"] as GitHubClient;
    github.setStub(false);

    await expect(svc.publish("c1")).rejects.toThrow(/GitHub API 403/);
  });
});

function jsonRes(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
