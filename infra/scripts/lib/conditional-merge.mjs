export const REQUIRED_CHECKS = ["quality", "smoke", "e2e"];
const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function parseConditionalMergeConfig(env = process.env, args = process.argv) {
  const errors = [];
  const managerUrl = env.MT_MERGE_MANAGER_URL ?? "";
  const managerToken = env.MT_MERGE_MANAGER_TOKEN ?? "";
  const githubToken = env.MT_MERGE_GITHUB_TOKEN ?? "";
  const baseBranch = env.MT_MERGE_BASE_BRANCH ?? "main";
  const maxCheckAgeMinutes = Number(env.MT_MERGE_MAX_CHECK_AGE_MINUTES ?? 1440);
  if (!/^https?:\/\//.test(managerUrl)) errors.push("MT_MERGE_MANAGER_URL 必须是 HTTP(S) 地址");
  if (managerToken.length < 32) errors.push("MT_MERGE_MANAGER_TOKEN 至少 32 个字符");
  if (githubToken.length < 32) errors.push("MT_MERGE_GITHUB_TOKEN 至少 32 个字符");
  if (!/^(?!\/)(?!.*\/\/)[A-Za-z0-9._/-]+$/.test(baseBranch)) errors.push("MT_MERGE_BASE_BRANCH 格式非法");
  if (!Number.isInteger(maxCheckAgeMinutes) || maxCheckAgeMinutes < 5 || maxCheckAgeMinutes > 10080) {
    errors.push("MT_MERGE_MAX_CHECK_AGE_MINUTES 必须是 5-10080 的整数");
  }
  const jobArg = getArgument(args, "--job");
  if (jobArg && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobArg)) {
    errors.push("--job 必须是 UUID");
  }
  return {
    valid: errors.length === 0,
    errors,
    managerUrl,
    managerToken,
    githubToken,
    baseBranch,
    maxCheckAgeMinutes,
    jobId: jobArg || null,
    dryRun: args.includes("--dry-run"),
  };
}

export class ConditionalMergeManagerClient {
  constructor({ baseUrl, token, fetchImpl = fetch }) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async authorization(jobId) {
    return this.request("GET", "/execution-jobs/" + encodeURIComponent(jobId) + "/merge-authorization");
  }

  async candidates() {
    return this.request("GET", "/execution-jobs/merge-candidates");
  }

  async request(method, path) {
    let response;
    try {
      response = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: { accept: "application/json", "x-manager-merge-token": this.token },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      throw new Error("Manager 请求失败：" + (error?.message ?? error));
    }
    return parseResponse(response, "Manager");
  }
}

export class ConditionalMergeGitHubClient {
  constructor({ token, baseUrl = "https://api.github.com", fetchImpl = fetch }) {
    this.token = token;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  async getPullRequest(repository, prNumber) {
    const [owner, name] = parseRepository(repository);
    return this.request("GET", "/repos/" + owner + "/" + name + "/pulls/" + prNumber);
  }

  async listPullRequestFiles(repository, prNumber) {
    const [owner, name] = parseRepository(repository);
    const files = [];
    for (let page = 1; page <= 10; page += 1) {
      const items = await this.request("GET", "/repos/" + owner + "/" + name + "/pulls/" + prNumber + "/files?per_page=100&page=" + page);
      files.push(...items);
      if (items.length < 100) return files;
    }
    throw new Error("PR 变更文件超过 1000 个，拒绝条件合并");
  }

  async getCheckRuns(repository, sha) {
    const [owner, name] = parseRepository(repository);
    return this.request("GET", "/repos/" + owner + "/" + name + "/commits/" + sha + "/check-runs?per_page=100");
  }

  async getBranchSha(repository, branch) {
    const [owner, name] = parseRepository(repository);
    const item = await this.request("GET", "/repos/" + owner + "/" + name + "/git/ref/heads/" + encodeURIComponent(branch));
    if (!SHA_PATTERN.test(item?.object?.sha ?? "")) throw new Error("GitHub base SHA 无效");
    return item.object.sha;
  }

  async getBranchProtection(repository, branch) {
    const [owner, name] = parseRepository(repository);
    try {
      return await this.request("GET", "/repos/" + owner + "/" + name + "/branches/" + encodeURIComponent(branch) + "/protection");
    } catch (error) {
      if (error?.status === 404 || error?.status === 403) return null;
      throw error;
    }
  }

  async merge({ repository, prNumber, candidateSha }) {
    const [owner, name] = parseRepository(repository);
    return this.request("PUT", "/repos/" + owner + "/" + name + "/pulls/" + prNumber + "/merge", {
      sha: candidateSha,
      merge_method: "merge",
    });
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
    return parseResponse(response, "GitHub");
  }
}

export async function runConditionalMerge({ config, manager, github, now = () => new Date() }) {
  const authorizations = config.jobId
    ? [await manager.authorization(config.jobId)]
    : await manager.candidates();
  const results = [];
  for (const authorization of authorizations) {
    if (!authorization?.eligible || !authorization.candidate) {
      results.push({ jobId: config.jobId, action: "manual", eligible: false, blockers: authorization?.blockers ?? ["Manager 未返回可合并候选"] });
      continue;
    }
    const candidate = authorization.candidate;
    const facts = await collectGitHubFacts({ github, candidate, config });
    const evaluation = evaluateMergeCandidate({ authorization, facts, config, now: now() });
    const result = {
      jobId: candidate.jobId,
      requirementId: candidate.requirementId,
      prNumber: candidate.prNumber,
      candidateSha: candidate.candidateSha,
      eligible: evaluation.eligible,
      blockers: evaluation.blockers,
    };
    if (!evaluation.eligible) {
      results.push({ ...result, action: "manual" });
      continue;
    }
    if (config.dryRun) {
      results.push({ ...result, action: "dry-run", checks: evaluation.checks });
      continue;
    }
    const merged = await github.merge({ repository: candidate.repository, prNumber: candidate.prNumber, candidateSha: candidate.candidateSha });
    if (merged?.merged !== true) throw new Error("GitHub 未确认合并成功");
    const afterMerge = await github.getPullRequest(candidate.repository, candidate.prNumber);
    if (afterMerge?.merged !== true || afterMerge?.merge_commit_sha == null) throw new Error("合并后 PR 事实核验失败");
    results.push({ ...result, action: "merged", mergeCommitSha: afterMerge.merge_commit_sha, checks: evaluation.checks });
  }
  return { schema: "magictools-conditional-merge/1", dryRun: config.dryRun, results };
}

export function evaluateMergeCandidate({ authorization, facts, config, now = new Date() }) {
  const candidate = authorization.candidate;
  const blockers = [];
  if (!candidate) return { eligible: false, blockers: ["缺少 Manager 合并授权"] };
  const pr = facts.pullRequest;
  if (!pr || pr.state !== "open" || pr.draft === true || pr.merged === true) blockers.push("PR 不是可合并的 open 状态");
  if (pr?.html_url !== candidate.prUrl) blockers.push("PR 链接与执行结果不匹配");
  if (pr?.head?.ref !== candidate.branch) blockers.push("PR head 分支与执行结果不匹配");
  if (pr?.head?.sha?.toLowerCase() !== candidate.candidateSha.toLowerCase()) blockers.push("PR head SHA 与执行结果不匹配");
  if (pr?.base?.ref !== config.baseBranch) blockers.push("PR base 分支不匹配");
  if (pr?.base?.sha?.toLowerCase() !== candidate.baseSha.toLowerCase()) blockers.push("PR base SHA 与执行基线不匹配");
  if (facts.currentBaseSha?.toLowerCase() !== candidate.baseSha.toLowerCase()) blockers.push("base 分支已有新提交，执行基线过期");

  const repositoryName = repositorySlug(candidate.repository);
  if (pr?.head?.repo?.full_name?.toLowerCase() !== repositoryName || pr?.base?.repo?.full_name?.toLowerCase() !== repositoryName) {
    blockers.push("PR head 或 base 不在执行契约仓库");
  }
  if (typeof pr?.mergeable !== "boolean" || !pr.mergeable || pr.mergeable_state !== "clean") blockers.push("GitHub 判定候选不可干净合并");

  const actualPaths = new Set();
  for (const file of facts.files) {
    if (!file?.filename) continue;
    actualPaths.add(normalizeGitPath(file.filename));
    if (file.previous_filename) actualPaths.add(normalizeGitPath(file.previous_filename));
  }
  const expectedPaths = candidate.changedPaths.map(normalizeGitPath).sort();
  const actualSorted = [...actualPaths].sort();
  if (expectedPaths.join("\n") !== actualSorted.join("\n")) blockers.push("PR 实际改动与执行结果不匹配");
  for (const path of actualSorted) {
    if (!isAllowedPath(path, candidate.allowedPaths)) blockers.push("契约外路径：" + path);
    if (isHighRiskPath(path)) blockers.push("高风险路径转人工：" + path);
  }

  const protection = facts.branchProtection;
  if (!protection) blockers.push("base 分支未启用保护或凭证无法读取保护规则");
  const contexts = protection?.required_status_checks?.contexts ?? [];
  for (const check of REQUIRED_CHECKS) {
    if (!contexts.includes(check)) blockers.push("base 分支未要求检查：" + check);
  }
  if (protection?.enforce_admins?.enabled !== true) blockers.push("base 分支保护未覆盖管理员");
  if (protection?.allow_force_pushes?.enabled === true) blockers.push("base 分支允许 force push");

  const checks = latestTrustedChecks(facts.checkRuns?.check_runs ?? [], config.maxCheckAgeMinutes, now);
  for (const check of REQUIRED_CHECKS) {
    if (!checks[check]) blockers.push("缺少可信成功检查：" + check);
  }
  return { eligible: blockers.length === 0, blockers, checks: Object.fromEntries(Object.entries(checks).map(([key, value]) => [key, {
    completedAt: value?.completedAt ?? null,
    detailsUrl: value?.detailsUrl ?? null,
  }])) };
}

async function collectGitHubFacts({ github, candidate, config }) {
  const [pullRequest, files, checkRuns, currentBaseSha, branchProtection] = await Promise.all([
    github.getPullRequest(candidate.repository, candidate.prNumber),
    github.listPullRequestFiles(candidate.repository, candidate.prNumber),
    github.getCheckRuns(candidate.repository, candidate.candidateSha),
    github.getBranchSha(candidate.repository, config.baseBranch),
    github.getBranchProtection(candidate.repository, config.baseBranch),
  ]);
  return { pullRequest, files, checkRuns, currentBaseSha, branchProtection };
}

function latestTrustedChecks(checkRuns, maxAgeMinutes, now) {
  const latest = {};
  const maxAgeMs = maxAgeMinutes * 60_000;
  for (const run of checkRuns) {
    if (!REQUIRED_CHECKS.includes(run?.name)) continue;
    const completedAt = new Date(run.completed_at ?? 0);
    const trusted = run.status === "completed" && run.conclusion === "success" &&
      run.app?.slug === "github-actions" &&
      typeof run.details_url === "string" && run.details_url.includes("/actions/runs/") &&
      Number.isFinite(completedAt.getTime()) && now.getTime() - completedAt.getTime() <= maxAgeMs;
    const previous = latest[run.name];
    if (!previous || new Date(run.completed_at ?? 0).getTime() > previous.completedTime) {
      latest[run.name] = {
        trusted,
        completedAt: run.completed_at ?? null,
        completedTime: new Date(run.completed_at ?? 0).getTime(),
        detailsUrl: run.details_url ?? null,
      };
    }
  }
  return Object.fromEntries(Object.entries(latest).filter(([, value]) => value.trusted));
}

function isAllowedPath(path, allowedPaths) {
  const normalized = normalizeGitPath(path);
  return allowedPaths.some((allowed) => {
    const normalizedAllowed = normalizeGitPath(allowed);
    return normalized === normalizedAllowed || normalized.startsWith(normalizedAllowed + "/");
  });
}

function isHighRiskPath(path) {
  const normalized = normalizeGitPath(path);
  const segments = normalized.split("/");
  const basename = segments.at(-1) ?? "";
  return normalized.startsWith(".github/workflows/") ||
    normalized.startsWith("infra/") ||
    normalized.startsWith("apps/gateway/") ||
    normalized.startsWith("packages/db/src/") ||
    normalized.startsWith("apps/assistant/server/src/") ||
    segments.includes("migrations") ||
    /(auth|identity|permission|credential|secret)/i.test(basename);
}

function normalizeGitPath(pathValue) {
  if (typeof pathValue !== "string" || !pathValue || pathValue.includes("\\") || pathValue.includes("//") ||
      pathValue.startsWith("/") || pathValue.split("/").includes("..")) {
    throw new Error("非法 Git 路径：" + pathValue);
  }
  return pathValue.replace(/\/+$/, "");
}

function repositorySlug(repository) {
  const [owner, name] = parseRepository(repository);
  return (owner + "/" + name).toLowerCase();
}

function parseRepository(repository) {
  const url = new URL(repository);
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") throw new Error("执行契约仓库必须是 GitHub HTTPS 地址");
  const parts = url.pathname.replace(/\/+$/, "").replace(/\.git$/, "").split("/").filter(Boolean);
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part))) throw new Error("GitHub 仓库格式无效");
  return parts;
}

async function parseResponse(response, source) {
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    const error = new Error(source + " HTTP " + response.status + "：" + text.slice(0, 500));
    error.status = response.status;
    throw error;
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(source + " 响应不是有效 JSON");
  }
}

function getArgument(args, name) {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : null;
}
