import { createHash } from "node:crypto";
import { BadGatewayException, Injectable, NotFoundException } from "@nestjs/common";
import { GitHubClient, type CommitFileChange } from "./github/client";
import {
  createEvidenceTaskWithCandidates,
  findEvidenceTask,
  getEvidenceTask,
  listEvidenceTasks,
  type EvidenceCandidateInput,
  type EvidenceCategory,
} from "./repository-evidence.repo";

const CATEGORY_TITLES: Record<EvidenceCategory, string> = {
  routes: "路由契约",
  controller: "接口行为",
  service: "业务能力",
  schema: "数据与参数契约",
  tests: "可验证行为",
};

function sourceCategory(path: string): EvidenceCategory | null {
  const normalized = path.toLowerCase();
  if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(normalized)) return null;
  if (/(^|\/)(tests?|__tests__)(\/|$)/.test(normalized) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return "tests";
  if (/(^|\/)routes?\.[cm]?[jt]sx?$/.test(normalized) || /(^|\/)routes?\//.test(normalized)) return "routes";
  if (/\.controller\.[cm]?[jt]sx?$/.test(normalized) || /(^|\/)controllers?\//.test(normalized)) return "controller";
  if (/\.service\.[cm]?[jt]sx?$/.test(normalized) || /(^|\/)services?\//.test(normalized)) return "service";
  if (/\.schema\.[cm]?[jt]sx?$/.test(normalized) || /(^|\/)schemas?([./]|$)/.test(normalized)) return "schema";
  return null;
}

function evidenceFromPatch(path: string, repo: string, commitSha: string, patch: string | undefined): {
  startLine: number;
  endLine: number;
  excerpt: string;
  url: string;
} | null {
  if (!patch) return null;
  let firstChangedLine = 0;
  let currentLine = 0;
  let lastChangedLine = 0;
  const changed: string[] = [];
  for (const line of patch.split(/\r?\n/)) {
    const hunk = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      currentLine = Number(hunk[1]);
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) {
      if (line.slice(1).trim()) changed.push(line.slice(1).trim());
      if (!firstChangedLine) firstChangedLine = currentLine;
      lastChangedLine = currentLine;
      currentLine += 1;
    } else if (line.startsWith("-")) {
      continue;
    } else if (line.startsWith(" ")) {
      currentLine += 1;
    }
  }
  if (!changed.length) return null;
  const startLine = firstChangedLine || 1;
  const excerpt = changed.slice(0, 6).join("\n");
  const endLine = lastChangedLine || startLine;
  return { startLine, endLine, excerpt, url: githubBlobUrl(path, repo, commitSha, startLine, endLine) };
}

function evidenceFromContent(path: string, repo: string, commitSha: string, content: string): {
  startLine: number;
  endLine: number;
  excerpt: string;
  url: string;
} {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim().length > 0);
  const startLine = index < 0 ? 1 : index + 1;
  const excerptLines = lines.slice(index < 0 ? 0 : index, (index < 0 ? 0 : index) + 6).filter((line) => line.trim());
  const endLine = startLine + Math.max(excerptLines.length - 1, 0);
  return {
    startLine,
    endLine,
    excerpt: excerptLines.join("\n") || "(空文件)",
    url: githubBlobUrl(path, repo, commitSha, startLine, endLine),
  };
}

function githubBlobUrl(path: string, repo: string, commitSha: string, startLine: number, endLine: number): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${repo}/blob/${commitSha}/${encodedPath}#L${startLine}-L${endLine}`;
}

@Injectable()
export class RepositoryEvidenceService {
  async reverseEngineer(input: { repo: string; commitSha: string }) {
    const client = new GitHubClient();
    let commit: Awaited<ReturnType<GitHubClient["getCommitSnapshot"]>>;
    try {
      commit = await client.getCommitSnapshot(input.repo, input.commitSha);
    } catch (error) {
      throw new BadGatewayException("GitHub提交采集失败: " + String(error));
    }
    const existing = await findEvidenceTask(input.repo, commit.sha);
    if (existing) return { created: false, ...existing };

    const selected = commit.files
      .map((file) => ({ file, category: sourceCategory(file.path) }))
      .filter((item): item is { file: CommitFileChange; category: EvidenceCategory } => item.category !== null);
    const candidates: EvidenceCandidateInput[] = [];
    for (const item of selected) {
      const contentRef = item.file.status === "removed" ? commit.parentSha : commit.sha;
      if (!contentRef) throw new BadGatewayException("GitHub提交缺少父提交，无法读取删除前源码");
      let content = "";
      try {
        content = await client.getFileContent(input.repo, contentRef, item.file.path);
      } catch (error) {
        throw new BadGatewayException("GitHub文件读取失败: " + String(error));
      }
      const fallback = item.file.patch?.split(/\r?\n/)
        .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
        .map((line) => line.slice(1).trim())
        .filter(Boolean) ?? [];
      const contentForEvidence = content || fallback.join("\n");
      const pointer = evidenceFromPatch(item.file.path, input.repo, contentRef, item.file.patch)
        ?? evidenceFromContent(item.file.path, input.repo, contentRef, contentForEvidence);
      candidates.push({
        title: `${CATEGORY_TITLES[item.category]}：${item.file.path}`,
        description: `提交 ${commit.sha.slice(0, 12)} ${item.file.status} 该文件；源码证明存在${CATEGORY_TITLES[item.category]}变更。`,
        motivation: "unknown",
        category: item.category,
        path: item.file.path,
        contentSha256: createHash("sha256").update(content || item.file.patch || "").digest("hex"),
        evidence: {
          commit: contentRef,
          path: item.file.path,
          startLine: pointer.startLine,
          endLine: pointer.endLine,
          url: pointer.url,
          excerpt: pointer.excerpt,
        },
      });
    }

    const result = await createEvidenceTaskWithCandidates({
      repo: input.repo,
      commitSha: commit.sha,
      commitMessage: commit.message,
      totalFiles: commit.files.length,
      candidates,
    });
    return result;
  }

  async list(limit?: number) {
    const rows = await listEvidenceTasks(limit);
    return { items: rows.map(({ task, candidates }) => ({ ...task, candidateCount: candidates.length })) };
  }

  async get(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new NotFoundException("仓库证据任务不存在");
    }
    const result = await getEvidenceTask(id);
    if (!result) throw new NotFoundException("仓库证据任务不存在");
    return result;
  }
}
