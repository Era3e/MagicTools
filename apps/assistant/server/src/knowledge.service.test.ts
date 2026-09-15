import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Citation } from "./conversation.repo";
import { llmChat } from "./llm";
import { KnowledgeService } from "./knowledge.service";
import type { ScholarSearchCandidate } from "./scholar.client";

vi.mock("./llm", () => ({ llmChat: vi.fn() }));

function candidate(no: number, title: string, evidence: string): ScholarSearchCandidate {
  return {
    entryId: "00000000-0000-0000-0000-00000000000" + no,
    source: "manual",
    title,
    category: "product",
    revisionId: "00000000-0000-0000-0000-00000000010" + no,
    revisionNo: 1,
    sourceRevision: "commit-p19",
    sourceUrl: "https://example.com/commit-p19",
    productVersionId: "00000000-0000-0000-0000-000000000021",
    productVersion: "1.0.0",
    deploymentRef: "registry@sha256:p19",
    chunkId: "00000000-0000-0000-0000-00000000020" + no,
    chunkNo: 2,
    content: evidence,
    charStart: 800,
    charEnd: 800 + evidence.length,
    score: 0.91,
    candidateNo: no,
    channels: ["fts", "vector"],
    requirementLinks: [{ requirementId: "REQ-P19", requirementUrl: "https://example.com/req", source: "manual" }],
  };
}

describe("KnowledgeService 引用对齐", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无关候选返回未找到且不带引用", async () => {
    const scholar = { search: vi.fn(async () => []) };
    const service = new KnowledgeService(scholar as never);
    await expect(service.answer("完全无关的问题")).resolves.toEqual({
      reply: "未找到相关知识，请先在 Scholar 中圈定相关内容。",
      citations: [],
    });
  });

  it("只保留可映射候选编号并携带修订/版本/字符区间证据", async () => {
    const first = candidate(1, "发布手册", "回退前保存数据库回执");
    const second = candidate(2, "采集手册", "采集任务按租约执行");
    const scholar = { search: vi.fn(async () => [first, second]) };
    vi.mocked(llmChat).mockResolvedValueOnce(JSON.stringify({ answer: "先保存回执。", citations: [1, 99] }));
    const service = new KnowledgeService(scholar as never);
    const result = await service.answer("如何回退发布");
    expect(result.reply).toBe("先保存回执。");
    expect(result.citations).toHaveLength(1);
    const citation = result.citations[0] as Required<Citation>;
    expect(citation.candidateNo).toBe(1);
    expect(citation.revisionId).toBe(first.revisionId);
    expect(citation.versionId).toBe(first.productVersionId);
    expect(citation.chunkNo).toBe(2);
    expect(citation.charStart).toBe(800);
    expect(citation.evidence).toBe("回退前保存数据库回执");
    expect(citation.requirementLinks).toEqual(first.requirementLinks);
  });

  it("模型引用编号全部无效时不返回幻觉答案", async () => {
    const hit = candidate(1, "发布手册", "回退前保存数据库回执");
    const scholar = { search: vi.fn(async () => [hit]) };
    vi.mocked(llmChat).mockResolvedValueOnce(JSON.stringify({ answer: "完全幻觉答案", citations: [99] }));
    const service = new KnowledgeService(scholar as never);
    const result = await service.answer("如何回退发布");
    expect(result.reply).toBe("基于知识库内容：发布手册");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].candidateNo).toBe(1);
    expect(result.reply).not.toContain("完全幻觉答案");
  });

  it("Scholar 服务异常时明确降级且不生成引用", async () => {
    const scholar = { search: vi.fn(async () => { throw new Error("gateway unavailable"); }) };
    const service = new KnowledgeService(scholar as never);
    await expect(service.answer("如何回退发布")).resolves.toEqual({
      reply: "知识服务暂不可用，请稍后重试。",
      citations: [],
    });
  });
});
