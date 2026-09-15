import { Inject, Injectable } from "@nestjs/common";
import type { Citation } from "./conversation.repo";
import { parseJson } from "./json";
import { llmChat } from "./llm";
import { answerSchema } from "./schemas";
import { ScholarClient, type ScholarSearchCandidate } from "./scholar.client";

const ANSWER_PROMPT =
  "你是知识问答助手。基于提供的知识候选回答用户问题，只输出 JSON：{answer: 回答文本, citations: [候选编号]}。引用只能使用候选编号，不能编造。{answer}";

@Injectable()
export class KnowledgeService {
  constructor(@Inject(ScholarClient) private readonly scholar: ScholarClient) {}

  async answer(question: string): Promise<{ reply: string; citations: Citation[] }> {
    let hits: ScholarSearchCandidate[];
    try {
      hits = await this.scholar.search(question, 5);
    } catch {
      return { reply: "知识服务暂不可用，请稍后重试。", citations: [] };
    }
    if (hits.length === 0) {
      return { reply: "未找到相关知识，请先在 Scholar 中圈定相关内容。", citations: [] };
    }
    const context = hits.map((hit) => [
      "候选 " + hit.candidateNo,
      "标题：" + hit.title,
      "版本：" + hit.productVersion,
      "证据：" + hit.content,
      "字符区间：" + hit.charStart + "-" + hit.charEnd,
    ].join("\n")).join("\n\n");
    const raw = await llmChat([
      { role: "system", content: ANSWER_PROMPT },
      { role: "user", content: "知识候选：\n" + context + "\n用户问题：" + question },
    ]);
    try {
      const parsed = answerSchema.parse(parseJson(raw));
      const selectedNos = [...new Set(parsed.citations.filter((no) => Number.isInteger(no) && no >= 1 && no <= hits.length))];
      if (selectedNos.length === 0) {
        return { reply: "基于知识库内容：" + hits[0].title, citations: [this.toCitation(hits[0])] };
      }
      const selected = hits.filter((hit) => selectedNos.includes(hit.candidateNo));
      const citations: Citation[] = selected.map((hit) => this.toCitation(hit));
      return { reply: parsed.answer, citations };
    } catch {
      const citations = [this.toCitation(hits[0])];
      return { reply: "基于知识库内容：" + hits[0].title, citations };
    }
  }

  private toCitation(hit: ScholarSearchCandidate): Citation {
    return {
      id: hit.entryId,
      title: hit.title,
      source: hit.source,
      score: Math.round(hit.score * 100) / 100,
      revisionId: hit.revisionId,
      versionId: hit.productVersionId,
      productVersion: hit.productVersion,
      chunkId: hit.chunkId,
      chunkNo: hit.chunkNo,
      evidence: hit.content,
      charStart: hit.charStart,
      charEnd: hit.charEnd,
      candidateNo: hit.candidateNo,
      requirementLinks: hit.requirementLinks,
    };
  }
}
