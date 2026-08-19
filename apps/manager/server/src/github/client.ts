interface GitHubConfig {
  token?: string;
  baseUrl?: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  url: string;
}

export interface GitHubPr {
  state: "open" | "closed";
  merged: boolean;
  url: string;
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

  async listIssues(repo: string): Promise<GitHubIssue[]> {
    if (this.stub) {
      return [
        { number: 1, title: "示例需求：支持批量导出", body: "来自桩模式", state: "open", labels: ["enhancement"], url: "https://github.com/any/repo/issues/1" },
        { number: 2, title: "示例缺陷：导出超时", body: "来自桩模式", state: "open", labels: ["bug"], url: "https://github.com/any/repo/issues/2" },
      ];
    }
    const match = repo.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (!match) throw new Error("仓库格式应为 owner/repo");
    const [, owner, name] = match;
    const items = (await this.getJson("/repos/" + owner + "/" + name + "/issues?state=open&per_page=50")) as Array<{
      number: number;
      title: string;
      body?: string;
      state: string;
      labels?: Array<{ name?: string }>;
      html_url: string;
    }>;
    return items.map((i) => ({
      number: i.number,
      title: i.title,
      body: i.body ?? "",
      state: i.state,
      labels: (i.labels ?? []).map((l) => l.name ?? "").filter(Boolean),
      url: i.html_url,
    }));
  }

  async getPr(repo: string, prNumber: number): Promise<GitHubPr> {
    if (this.stub) return { state: "open", merged: false, url: "https://github.com/any/repo/pull/" + prNumber };
    const match = repo.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (!match) throw new Error("仓库格式应为 owner/repo");
    const [, owner, name] = match;
    const item = (await this.getJson("/repos/" + owner + "/" + name + "/pulls/" + prNumber)) as {
      state: string;
      merged?: boolean;
      html_url: string;
    };
    return { state: item.state === "closed" ? "closed" : "open", merged: Boolean(item.merged), url: item.html_url };
  }
}
