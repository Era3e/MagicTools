interface GitHubConfig {
  token?: string;
  baseUrl?: string;
}

export interface RepoContext {
  readme: string;
  tree: string[];
  languages: string[];
  defaultBranch: string;
}

export interface CommitFileChange {
  path: string;
  previousPath?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface CommitSnapshot {
  sha: string;
  parentSha?: string;
  message: string;
  files: CommitFileChange[];
}

export class GitHubClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private stub = false;

  constructor(config: GitHubConfig = {}) {
    this.token = config.token ?? process.env.GITHUB_TOKEN ?? "";
    this.baseUrl = (config.baseUrl ?? "https://api.github.com").replace(/\/+$/, "");
    if (process.env.GITHUB_STUB === "1") this.stub = true;
  }

  setStub(value: boolean) {
    this.stub = value;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (this.token) h.Authorization = "Bearer " + this.token;
    return h;
  }

  private async getJson(path: string): Promise<unknown> {
    const response = await fetch(this.baseUrl + path, { headers: this.headers() });
    if (!response.ok) throw new Error("GitHub API " + response.status);
    return response.json();
  }

  private parseRepo(repo: string): { owner: string; name: string } {
    const match = repo.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (!match) throw new Error("仓库格式应为 owner/repo");
    return { owner: match[1], name: match[2] };
  }

  async getRepoContext(repo: string): Promise<RepoContext> {
    if (this.stub) {
      return {
        readme: "# 示例项目\n\n这是桩模式的 README。",
        tree: ["src/index.ts", "src/app.ts", "README.md"],
        languages: ["TypeScript"],
        defaultBranch: "main",
      };
    }
    const { owner, name } = this.parseRepo(repo);
    const base = "/repos/" + owner + "/" + name;

    const meta = (await this.getJson(base)) as { default_branch?: string };
    const defaultBranch = meta.default_branch ?? "main";

    let readme = "";
    try {
      const rm = (await this.getJson(base + "/readme")) as { content?: string };
      if (rm.content) readme = Buffer.from(rm.content, "base64").toString("utf8");
    } catch {
      readme = "（无 README）";
    }

    const t = (await this.getJson(base + "/git/trees/" + defaultBranch + "?recursive=1")) as {
      truncated?: boolean;
      tree?: Array<{ path: string; type: string }>;
    };
    if (t.truncated) throw new Error("GitHub仓库目录被截断，禁止静默采集");
    const tree = (t.tree ?? []).filter((x) => x.type === "blob").map((x) => x.path);

    let languages: string[] = [];
    try {
      const l = (await this.getJson(base + "/languages")) as Record<string, number>;
      languages = Object.entries(l).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    } catch {
      languages = [];
    }

    return { readme: readme.slice(0, 20000), tree, languages, defaultBranch };
  }

  async getCommitSnapshot(repo: string, ref: string): Promise<CommitSnapshot> {
    if (!/^[0-9a-f]{7,40}$/i.test(ref)) throw new Error("提交SHA格式非法");
    if (this.stub) {
      return {
        sha: "f".repeat(40),
        parentSha: "e".repeat(40),
        message: "feat: 增加示例导出能力",
        files: [
          { path: "src/routes.ts", status: "modified", additions: 8, deletions: 1, patch: "@@ -3,6 +3,9 @@\n const routes = [];\n+export const exportRoute = \"/export\";\n export default routes;" },
          { path: "src/export.controller.ts", status: "added", additions: 24, deletions: 0, patch: "@@ -0,0 +1,24 @@\n+import { ExportService } from \"./export.service\";\n+export class ExportController {}\n+}" },
          { path: "src/export.service.ts", status: "modified", additions: 18, deletions: 2, patch: "@@ -10,7 +10,12 @@\n+export async function exportRows() {}" },
          { path: "src/schemas.ts", status: "modified", additions: 6, deletions: 0, patch: "@@ -20,6 +20,12 @@\n+export const exportSchema = {}" },
          { path: "src/export.service.test.ts", status: "added", additions: 16, deletions: 0, patch: "@@ -0,0 +1,16 @@\n+it(\"导出数据\", () => {});" },
          { path: "src/legacy.service.test.ts", status: "removed", additions: 0, deletions: 8, patch: "@@ -1,8 +0,0 @@\n-it(\"旧导出逻辑\", () => {});" },
          { path: "README.md", status: "modified", additions: 2, deletions: 1, patch: "@@ -1,3 +1,4 @@\n+文档" },
        ],
      };
    }
    const { owner, name } = this.parseRepo(repo);
    const commit = (await this.getJson(`/repos/${owner}/${name}/commits/${ref}`)) as {
      sha?: string;
      parents?: Array<{ sha?: string }>;
      commit?: { message?: string };
      truncated?: boolean;
      files?: Array<{
        filename?: string;
        previous_filename?: string;
        status?: string;
        additions?: number;
        deletions?: number;
        patch?: string;
      }>;
    };
    if (commit.truncated) throw new Error("GitHub提交文件清单被截断，禁止静默采集");
    const files = (commit.files ?? []).map((file) => ({
      path: file.filename ?? "",
      previousPath: file.previous_filename,
      status: file.status ?? "changed",
      additions: file.additions ?? 0,
      deletions: file.deletions ?? 0,
      patch: file.patch,
    })).filter((file) => file.path);
    if (files.length > 200) throw new Error(`GitHub提交变更文件超过200个（${files.length}），请缩小采集范围`);
    const sha = commit.sha ?? ref;
    const parentSha = commit.parents?.[0]?.sha;
    return { sha, parentSha, message: commit.commit?.message ?? "", files };
  }

  async getFileContent(repo: string, ref: string, path: string): Promise<string> {
    if (!path || path.includes("..") || path.startsWith("/") || path.includes("\\")) {
      throw new Error("文件路径非法");
    }
    if (this.stub) {
      if (path.endsWith("routes.ts")) return "export const routes = [\"/export\"];\n";
      if (path.endsWith(".controller.ts")) return "export class ExportController {\n  async export() { return true; }\n}\n";
      if (path.endsWith(".service.ts")) return "export class ExportService {\n  async exportRows() { return []; }\n}\n";
      if (path.endsWith("schemas.ts")) return "export const exportSchema = { type: \"object\" };\n";
      if (path.endsWith(".test.ts")) return "import { describe, it } from \"vitest\";\ndescribe(\"export\", () => {\n  it(\"exports rows\", () => {});\n});\n";
      if (path.endsWith("legacy.service.test.ts") && ref === "e".repeat(40)) return "it(\"旧导出逻辑\", () => {});\n";
      return "# 示例项目\n";
    }
    if (!/^[0-9a-f]{7,40}$/i.test(ref)) throw new Error("提交SHA格式非法");
    const { owner, name } = this.parseRepo(repo);
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const content = (await this.getJson(`/repos/${owner}/${name}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`)) as {
      type?: string;
      encoding?: string;
      content?: string;
      size?: number;
    };
    if (content.type === "symlink" || content.type === "submodule") throw new Error(`不支持读取文件类型: ${content.type}`);
    if (content.size !== undefined && content.size > 200_000) throw new Error(`文件过大，禁止整读: ${path}`);
    if (content.encoding !== "base64" || content.content === undefined) throw new Error(`文件内容不可读: ${path}`);
    return Buffer.from(content.content, "base64").toString("utf8");
  }
}
