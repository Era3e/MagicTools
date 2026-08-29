#!/usr/bin/env node
/**
 * D-18: linux 视觉基线回传脚本（CI visual-baseline workflow 专用）
 *
 * 作用：把 runner 上生成的 e2e/snapshots/**-linux.png 经 GitHub REST API
 * 提交到 feat/visual-baseline-linux 分支并开 PR（合入后 CI e2e 的视觉
 * 用例守卫检测到 -linux.png 存在即自动真跑）。
 *
 * 为什么不用 git push：runner 的 GITHUB_TOKEN 默认不触发后续 workflow，
 * 且基线属于「生成物回仓」场景，走 contents API + PR 是最干净路径。
 *
 * 环境变量：GH_TOKEN（PAT，contents:write + pull_request）、NOTE（PR 描述）
 */

const REPO_FULL = "Era3e/MagicTools";
const BRANCH = "feat/visual-baseline-linux";
const API = `https://api.github.com/repos/${REPO_FULL}`;

const token = process.env.GH_TOKEN;
if (!token) {
  console.error("[baseline-push] 缺少 GH_TOKEN（需 VISUAL_BASELINE_TOKEN secret）");
  process.exit(1);
}
const note = process.env.NOTE || "前台视觉/主题变更，重新生成 linux 基线";

/** GitHub REST 请求封装（token + JSON + 幂等重试） */
async function gh(path, init = {}, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "magictools-baseline-push",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    if (res.ok) return res.status === 204 ? null : await res.json();
    if (res.status >= 500 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} ${path}: ${body.slice(0, 300)}`);
  }
}

async function main() {
  // 1. 收集基线文件（只挑本次新生成的 linux 基线，不碰 win32）
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join, relative } = await import("node:path");
  const snapshotsDir = join(process.cwd(), "e2e", "snapshots");
  const files = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.name.endsWith("-linux.png")) files.push(abs);
    }
  })(snapshotsDir);
  if (files.length === 0) throw new Error("未找到 -linux.png 基线文件");
  console.log(`[baseline-push] 待提交 ${files.length} 张 linux 基线`);

  // 2. 基准：main 最新 commit
  const mainRef = await gh("/git/ref/heads/main");
  const baseSha = mainRef.object.sha;
  const baseCommit = await gh(`/git/commits/${baseSha}`);
  const baseTree = baseCommit.tree.sha;

  // 3. 建 tree（中文/箭头文件名走 path 字段，无需 URL 编码——body 是 JSON）
  const tree = await gh("/git/trees", {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseTree,
      tree: files.map((abs) => ({
        path: relative(process.cwd(), abs).replace(/\\/g, "/"),
        mode: "100644",
        type: "blob",
        content: readFileSync(abs).toString("base64"),
      })),
    }),
  });

  // 4. 建 commit + 分支（已存在则强制指向新 commit——基线重生成场景）
  const commit = await gh("/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: "chore(e2e): 重新生成 linux 视觉基线（visual-baseline workflow）",
      tree: tree.sha,
      parents: [baseSha],
    }),
  });
  try {
    await gh(`/git/refs/heads/${BRANCH}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: true }),
    });
  } catch {
    await gh("/git/refs", {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: commit.sha }),
    });
  }
  console.log(`[baseline-push] 分支 ${BRANCH} → ${commit.sha.slice(0, 7)}`);

  // 5. 开 PR（已存在同 head 的 open PR 则复用不重复开）
  const prs = await gh(`/pulls?head=${REPO_FULL}:${BRANCH}&state=open`);
  let prUrl;
  if (Array.isArray(prs) && prs.length > 0) {
    prUrl = prs[0].html_url;
    console.log(`[baseline-push] 复用已有 PR: ${prUrl}`);
  } else {
    const pr = await gh("/pulls", {
      method: "POST",
      body: JSON.stringify({
        title: "chore(e2e): linux 视觉基线更新（visual-baseline workflow 自动生成）",
        head: BRANCH,
        base: "main",
        body: `## 变更说明\n\nD-18 基线生成 workflow 产物：${files.length} 张 linux 视觉基线（ubuntu + fonts-noto-cjk 环境）。\n\n**更新原因**：${note}\n\n**合入效果**：CI e2e 视觉用例守卫将检测到 -linux.png 存在，自动从 skip 转为真跑（跨平台像素比对闭环）。\n\n## 自检清单\n\n- [x] **0 bug loop 验收记录**：workflow 自动生成（PLAYWRIGHT_UPDATE=1 + 16 张产物校验 ≥16），生成日志即验收产物\n- [x] 纯基线二进制产物，无代码逻辑变更\n- [x] win32 基线不受影响（平台后缀独立）`,
      }),
    });
    prUrl = pr.html_url;
    console.log(`[baseline-push] 已开 PR: ${prUrl}`);
  }
}

main().catch((err) => {
  console.error("[baseline-push] 失败:", err);
  process.exit(1);
});
