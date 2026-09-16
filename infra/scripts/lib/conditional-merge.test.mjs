import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateMergeCandidate,
  parseConditionalMergeConfig,
  runConditionalMerge,
} from "./conditional-merge.mjs";

const candidateSha = "b".repeat(40);
const baseSha = "a".repeat(40);
const authorization = () => ({
  eligible: true,
  blockers: [],
  candidate: {
    jobId: "0b6ef267-d1d4-4e70-a30a-5b5d0f5b70e7",
    runId: "af80ab90-6b4e-4717-9960-b4d64a4a52e7",
    requirementId: "8e30cd78-e7c2-4dd4-b4b4-6b7386e92c1c",
    contentRevision: 1,
    repository: "https://github.com/Era3e/MagicTools",
    allowedPaths: ["apps/scholar/web/src"],
    baseSha,
    candidateSha,
    changedPaths: ["apps/scholar/web/src/example.tsx"],
    prNumber: 97,
    prUrl: "https://github.com/Era3e/MagicTools/pull/97",
    branch: "auto/req-demo/r1",
  },
});

const facts = () => ({
  pullRequest: {
    state: "open",
    html_url: "https://github.com/Era3e/MagicTools/pull/97",
    draft: false,
    merged: false,
    mergeable: true,
    mergeable_state: "clean",
    head: { ref: "auto/req-demo/r1", sha: candidateSha, repo: { full_name: "Era3e/MagicTools" } },
    base: { ref: "main", sha: baseSha, repo: { full_name: "Era3e/MagicTools" } },
  },
  files: [{ filename: "apps/scholar/web/src/example.tsx", status: "modified" }],
  checkRuns: { check_runs: ["quality", "smoke", "e2e"].map((name) => ({
    name,
    status: "completed",
    conclusion: "success",
    completed_at: "2026-09-16T00:00:00.000Z",
    details_url: "https://github.com/Era3e/MagicTools/actions/runs/1",
    app: { slug: "github-actions" },
  })) },
  currentBaseSha: baseSha,
  branchProtection: {
    required_status_checks: { contexts: ["quality", "smoke", "e2e"] },
    enforce_admins: { enabled: true },
    allow_force_pushes: { enabled: false },
  },
});

const config = () => ({ baseBranch: "main", maxCheckAgeMinutes: 60, dryRun: false, jobId: authorization().candidate.jobId });

test("配置校验拒绝缺失凭证和非法参数", () => {
  const invalid = parseConditionalMergeConfig({}, ["node", "conditional-merge.mjs", "--job", "not-uuid"]);
  assert.equal(invalid.valid, false);
  assert.deepEqual(invalid.errors, [
    "MT_MERGE_MANAGER_URL 必须是 HTTP(S) 地址",
    "MT_MERGE_MANAGER_TOKEN 至少 32 个字符",
    "MT_MERGE_GITHUB_TOKEN 至少 32 个字符",
    "--job 必须是 UUID",
  ]);

  const valid = parseConditionalMergeConfig({
    MT_MERGE_MANAGER_URL: "http://127.0.0.1:5004",
    MT_MERGE_MANAGER_TOKEN: "m".repeat(32),
    MT_MERGE_GITHUB_TOKEN: "g".repeat(32),
  }, ["node", "conditional-merge.mjs"]);
  assert.equal(valid.valid, true);
  assert.equal(valid.baseBranch, "main");
});

test("低风险候选在身份、边界、保护和可信检查全部匹配时可合并", () => {
  const result = evaluateMergeCandidate({
    authorization: authorization(),
    facts: facts(),
    config: config(),
    now: new Date("2026-09-16T00:10:00.000Z"),
  });
  assert.equal(result.eligible, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.checks.quality.detailsUrl, "https://github.com/Era3e/MagicTools/actions/runs/1");
});

test("head、基线和文件事实漂移都会拒绝合并", () => {
  const wrongPr = facts();
  wrongPr.pullRequest.html_url = "https://github.com/Era3e/MagicTools/pull/98";
  assert.ok(evaluateMergeCandidate({ authorization: authorization(), facts: wrongPr, config: config(), now: new Date() }).blockers.join().includes("PR 链接与执行结果不匹配"));

  const headDrift = facts();
  headDrift.pullRequest.head.sha = "c".repeat(40);
  assert.ok(evaluateMergeCandidate({ authorization: authorization(), facts: headDrift, config: config(), now: new Date() }).blockers.join().includes("PR head SHA 与执行结果不匹配"));

  const staleBase = facts();
  staleBase.currentBaseSha = "d".repeat(40);
  assert.ok(evaluateMergeCandidate({ authorization: authorization(), facts: staleBase, config: config(), now: new Date() }).blockers.join().includes("执行基线过期"));

  const changedDrift = facts();
  changedDrift.files = [{ filename: "apps/gatherer/web/src/outside.ts", status: "modified" }];
  const blockers = evaluateMergeCandidate({ authorization: authorization(), facts: changedDrift, config: config(), now: new Date() }).blockers.join();
  assert.ok(blockers.includes("PR 实际改动与执行结果不匹配"));
  assert.ok(blockers.includes("契约外路径"));
});

test("工作流、迁移和核心问答路径即使契约允许也转人工", () => {
  for (const path of [
    ".github/workflows/ci.yml",
    "apps/manager/server/migrations/001.sql",
    "apps/assistant/server/src/chat.service.ts",
    "apps/scholar/web/src/auth-service.ts",
  ]) {
    const risky = facts();
    risky.files = [{ filename: path, status: "modified" }];
    const allowed = authorization();
    allowed.candidate.changedPaths = [path];
    allowed.candidate.allowedPaths = [path.split("/").slice(0, 3).join("/")];
    if (path.endsWith("ci.yml")) allowed.candidate.allowedPaths = [".github/workflows"];
    if (path.endsWith("chat.service.ts")) allowed.candidate.allowedPaths = ["apps/assistant/server/src"];
    const result = evaluateMergeCandidate({ authorization: allowed, facts: risky, config: config(), now: new Date() });
    assert.equal(result.eligible, false);
    assert.ok(result.blockers.some((blocker) => blocker.startsWith("高风险路径转人工")));
  }
});

test("过期、非 GitHub Actions 或缺少 required check 时拒绝合并", () => {
  const expired = facts();
  expired.checkRuns.check_runs = expired.checkRuns.check_runs.map((run) => ({ ...run, completed_at: "2026-09-15T00:00:00.000Z" }));
  assert.ok(evaluateMergeCandidate({ authorization: authorization(), facts: expired, config: config(), now: new Date("2026-09-16T00:10:00.000Z") }).blockers.includes("缺少可信成功检查：quality"));

  const spoofed = facts();
  spoofed.checkRuns.check_runs = spoofed.checkRuns.check_runs.map((run) => ({ ...run, app: { slug: "not-github-actions" } }));
  assert.ok(evaluateMergeCandidate({ authorization: authorization(), facts: spoofed, config: config(), now: new Date() }).blockers.includes("缺少可信成功检查：e2e"));

  const unprotected = facts();
  unprotected.branchProtection.required_status_checks.contexts = ["quality", "smoke"];
  assert.ok(evaluateMergeCandidate({ authorization: authorization(), facts: unprotected, config: config(), now: new Date() }).blockers.includes("base 分支未要求检查：e2e"));

  const adminBypass = facts();
  adminBypass.branchProtection.enforce_admins.enabled = false;
  assert.ok(evaluateMergeCandidate({ authorization: authorization(), facts: adminBypass, config: config(), now: new Date() }).blockers.includes("base 分支保护未覆盖管理员"));
});

test("dry-run 不触发 merge，成功合并会回读 GitHub 事实", async () => {
  const merged = [];
  const github = {
    getPullRequest: async () => {
      return merged.length
        ? { ...facts().pullRequest, merged: true, merge_commit_sha: "e".repeat(40) }
        : facts().pullRequest;
    },
    listPullRequestFiles: async () => facts().files,
    getCheckRuns: async () => facts().checkRuns,
    getBranchSha: async () => baseSha,
    getBranchProtection: async () => facts().branchProtection,
    merge: async (input) => {
      merged.push(input);
      return { merged: true };
    },
  };
  const dryRun = await runConditionalMerge({
    config: { ...config(), dryRun: true },
    manager: { authorization: async () => authorization() },
    github,
    now: () => new Date("2026-09-16T00:10:00.000Z"),
  });
  assert.equal(dryRun.results[0].action, "dry-run");
  assert.equal(merged.length, 0);

  const receipt = await runConditionalMerge({
    config: config(),
    manager: { authorization: async () => authorization() },
    github,
    now: () => new Date("2026-09-16T00:10:00.000Z"),
  });
  assert.equal(receipt.results[0].action, "merged");
  assert.equal(merged.length, 1);
  assert.equal(merged[0].candidateSha, candidateSha);
});
