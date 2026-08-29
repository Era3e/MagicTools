interface GitHubConfig {
  token?: string;
  baseUrl?: string;
}

export interface GitHubPr {
  number: number;
  url: string;
  html_url: string;
}

export interface GitHubBranchRef {
  ref: string;
  sha: string;
  url: string;
}

export interface GitHubCreateFileResult {
  sha: string;
  url: string;
  content: { sha: string };
}

/**
 * Designer 专用 GitHub Client
 * 负责：获取 base branch → 创建临时分支 → 提交文件 → 创建 PR
 */
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

  /** 桩模式只读访问（供 service 层判断） */
  get isStub(): boolean {
    return this.stub;
  }

  /** headers 暴露给 service 层做额外 fetch */
  getHeaders(): Record<string, string> {
    return this.headers();
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
    if (this.token) h.Authorization = "Bearer " + this.token;
    return h;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(this.baseUrl + path, {
      method,
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error("GitHub API " + response.status + " " + method + " " + path + " " + text);
    }
    return response.json();
  }

  /** 获取分支最新 commit SHA（用于从该 commit 创建新分支） */
  async getBranchSha(repo: string, branch: string): Promise<string> {
    if (this.stub) return "stub-sha-" + Date.now();
    const [owner, name] = this.parseRepo(repo);
    const data = (await this.request("GET", "/repos/" + owner + "/" + name + "/git/ref/heads/" + branch)) as {
      object: { sha: string };
    };
    return data.object.sha;
  }

  /** 创建新分支 */
  async createBranch(repo: string, branchName: string, fromSha: string): Promise<GitHubBranchRef> {
    if (this.stub) {
      return { ref: "refs/heads/" + branchName, sha: "stub-sha-" + Date.now(), url: "https://github.com/" + repo + "/tree/" + branchName };
    }
    const [owner, name] = this.parseRepo(repo);
    return (await this.request("POST", "/repos/" + owner + "/" + name + "/git/refs", {
      ref: "refs/heads/" + branchName,
      sha: fromSha,
    })) as GitHubBranchRef;
  }

  /** 在指定分支创建/更新文件 */
  async createOrUpdateFile(
    repo: string,
    path: string,
    message: string,
    content: string,
    branch: string,
    sha?: string,
  ): Promise<GitHubCreateFileResult> {
    if (this.stub) {
      return { sha: "stub-sha-" + Date.now(), url: "https://github.com/" + repo + "/blob/" + branch + "/" + path, content: { sha: "stub-content" } };
    }
    const [owner, name] = this.parseRepo(repo);
    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch,
    };
    if (sha) body.sha = sha;
    return (await this.request("PUT", "/repos/" + owner + "/" + name + "/contents/" + path, body)) as GitHubCreateFileResult;
  }

  /** 创建 Pull Request */
  async createPr(
    repo: string,
    title: string,
    head: string,
    base: string,
    body: string,
    draft = false,
  ): Promise<GitHubPr> {
    if (this.stub) {
      const num = Math.floor(Math.random() * 100) + 1;
      return { number: num, url: "https://github.com/" + repo + "/pull/" + num, html_url: "https://github.com/" + repo + "/pull/" + num };
    }
    const [owner, name] = this.parseRepo(repo);
    return (await this.request("POST", "/repos/" + owner + "/" + name + "/pulls", {
      title,
      head,
      base,
      body,
      draft,
    })) as GitHubPr;
  }

  private parseRepo(repo: string): [string, string] {
    const match = repo.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (!match) throw new Error("仓库格式应为 owner/repo");
    return [match[1], match[2]];
  }
}
