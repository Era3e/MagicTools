import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { validateDatabaseEvidence } from "./database-validation.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function captureValidationIdentity(root, env = process.env, validationId = randomBytes(12).toString("hex")) {
  const rawGit = (...args) => execFileSync("git", args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).toString("utf8");
  const git = (...args) => rawGit(...args).trim();
  const checkoutSha = git("rev-parse", "HEAD");
  const tree = git("rev-parse", "HEAD^{tree}");
  const status = rawGit("status", "--porcelain=v1", "-z");
  const untracked = rawGit("ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean).sort().map((file) => {
    const path = join(root, file);
    return { path: file, sha256: sha256(lstatSync(path).isSymbolicLink() ? readlinkSync(path) : readFileSync(path)) };
  });
  const patch = execFileSync("git", ["diff", "--no-ext-diff", "--binary", "HEAD"], { cwd: root, windowsHide: true });
  const fingerprint = sha256(JSON.stringify({ tree, status, patch: sha256(patch), untracked }));
  const parents = git("cat-file", "-p", "HEAD").split("\n\n")[0].split("\n").filter((line) => line.startsWith("parent ")).map((line) => line.slice(7));
  let candidateSha = checkoutSha;
  let baseSha = checkoutSha;
  let repository = "local";
  let runId = "local";
  let attempt = "1";
  if (env.GITHUB_ACTIONS === "true") {
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
    candidateSha = event.pull_request?.head?.sha ?? env.GITHUB_SHA;
    baseSha = event.pull_request?.base?.sha ?? (event.before && !/^0+$/.test(event.before) ? event.before : parents[0] ?? checkoutSha);
    if (env.GITHUB_SHA !== checkoutSha || !/^[a-f0-9]{40}$/.test(candidateSha) || !/^[a-f0-9]{40}$/.test(baseSha) || (candidateSha !== checkoutSha && !parents.includes(candidateSha))) throw new Error("实际 checkout 与 CI 候选不匹配");
    if (event.pull_request) {
      if (candidateSha !== checkoutSha) {
        if (parents.length !== 2 || parents[0] !== baseSha || parents[1] !== candidateSha) throw new Error("被测合并提交与 PR 基线不匹配");
      } else {
        try { git("merge-base", "--is-ancestor", baseSha, checkoutSha); }
        catch { throw new Error("无法证明 PR head checkout 包含声明基线，请检出完整合并候选"); }
      }
    }
    if (status) throw new Error("CI 验证工作树必须干净");
    repository = env.GITHUB_REPOSITORY;
    runId = env.GITHUB_RUN_ID;
    attempt = env.GITHUB_RUN_ATTEMPT;
    if (!repository || !runId || !attempt) throw new Error("CI 运行身份缺失");
  } else {
    try { baseSha = git("merge-base", "HEAD", "refs/remotes/origin/main"); }
    catch { try { baseSha = git("merge-base", "HEAD", "main"); } catch { /* 独立仓库没有 main 时，以实际 HEAD 为基准。 */ } }
    try { repository = new URL(git("remote", "get-url", "origin")).pathname.replace(/^\//, "").replace(/\.git$/, ""); }
    catch { /* 本地无远程仓库时标记 local，不伪造托管仓库身份。 */ }
  }
  return { candidateSha, checkoutSha, baseSha, tree, fingerprint, repository, runId, attempt, validationId, clean: !status };
}

export function verifyQualityEvidence(report, { identity, stages, databaseManifest }) {
  if (report?.schema !== "magictools-quality-evidence/1" || report.success !== true) throw new Error("验证证据未成功完成");
  for (const key of ["candidateSha", "checkoutSha", "baseSha", "tree", "fingerprint", "runId", "attempt", "validationId", "repository"]) {
    if (!identity[key] || report.identity?.[key] !== identity[key]) throw new Error("验证证据身份不匹配：" + key);
  }
  const modeMatches = (mode) => mode?.database === "real" && mode.external === "stub-or-mock" && mode.liveModel === "not-run";
  if (!modeMatches(report.mode)) throw new Error("验证模式缺失或与实际质量门禁不符");
  if (!Array.isArray(report.stages) || report.stages.length !== stages.length || !stages.length) throw new Error("验证阶段缺失");
  for (const [index, stage] of report.stages.entries()) {
    if (stage.id !== stages[index] || stage.status !== "passed" || stage.exitCode !== 0) throw new Error("验证阶段未通过：" + stages[index]);
    if (stage.id === "database") {
      if (!modeMatches(stage.database?.mode)) throw new Error("数据库阶段验证模式无效");
      for (const key of ["candidateSha", "checkoutSha", "baseSha", "tree", "fingerprint", "runId", "attempt", "validationId", "repository"]) {
        if (stage.database?.identity?.[key] !== identity[key]) throw new Error("数据库证据身份不匹配：" + key);
      }
      validateDatabaseEvidence(stage.database, databaseManifest);
    }
  }
}
