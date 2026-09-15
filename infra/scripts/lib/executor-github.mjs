export class ExecutorGitHubClient {
  constructor({ token, baseUrl = "https://api.github.com", fetchImpl = fetch }) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  async getBranchSha(repository, branch) {
    const [owner, name] = parseRepository(repository);
    const item = await this.request("GET", "/repos/" + owner + "/" + name + "/git/ref/heads/" + encodeURIComponent(branch));
    if (!/^[0-9a-f]{40}$/.test(item?.object?.sha ?? "")) throw new Error("GitHub base SHA 无效");
    return item.object.sha;
  }

  async findOpenPullRequest(repository, branch) {
    const [owner, name] = parseRepository(repository);
    const items = await this.request("GET", "/repos/" + owner + "/" + name + "/pulls?state=open&head=" + encodeURIComponent(owner + ":" + branch));
    if (!items.length) return null;
    return { prNumber: items[0].number, prUrl: items[0].html_url, branch };
  }

  async createPullRequest({ repository, title, head, base, body }) {
    const [owner, name] = parseRepository(repository);
    const item = await this.request("POST", "/repos/" + owner + "/" + name + "/pulls", { title, head, base, body, draft: false });
    if (!item?.number || !item?.html_url) throw new Error("GitHub PR 响应缺少编号或链接");
    return { prNumber: item.number, prUrl: item.html_url, branch: head };
  }

  async request(method, path, body) {
    let response;
    try {
      response = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: {
          accept: "application/vnd.github+json",
          "content-type": "application/json",
          authorization: "Bearer " + this.token,
          "x-github-api-version": "2022-11-28",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new Error("GitHub 请求失败：" + (error?.message ?? error));
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error("GitHub HTTP " + response.status + "：" + text.slice(0, 500));
    }
    return response.json();
  }
}

export function parseRepository(repository) {
  const url = new URL(repository);
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") throw new Error("执行契约仓库必须是 GitHub HTTPS 地址");
  const parts = url.pathname.replace(/\/+$/, "").replace(/\.git$/, "").split("/").filter(Boolean);
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part))) throw new Error("GitHub 仓库格式无效");
  return parts;
}
