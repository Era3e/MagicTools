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

  async getRepoContext(repo: string): Promise<RepoContext> {
    if (this.stub) {
      return {
        readme: "# 示例项目\n\n这是桩模式的 README。",
        tree: ["src/index.ts", "src/app.ts", "README.md"],
        languages: ["TypeScript"],
        defaultBranch: "main",
      };
    }
    const match = repo.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (!match) throw new Error("仓库格式应为 owner/repo");
    const [, owner, name] = match;
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

    let tree: string[] = [];
    try {
      const t = (await this.getJson(base + "/git/trees/" + defaultBranch + "?recursive=1")) as {
        truncated?: boolean;
        tree?: Array<{ path: string; type: string }>;
      };
      tree = (t.tree ?? []).filter((x) => x.type === "blob").map((x) => x.path).slice(0, 200);
    } catch {
      tree = [];
    }

    let languages: string[] = [];
    try {
      const l = (await this.getJson(base + "/languages")) as Record<string, number>;
      languages = Object.entries(l).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    } catch {
      languages = [];
    }

    return { readme: readme.slice(0, 20000), tree, languages, defaultBranch };
  }
}
