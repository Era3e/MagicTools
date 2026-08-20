import { Injectable } from "@nestjs/common";
import type { Citation } from "./conversation.repo";
import { parseJson } from "./json";
import { embed, llmChat } from "./llm";
import { answerSchema } from "./schemas";
import { ftsSearchScoped, vectorSearchScoped } from "./search.repo";

const ANSWER_PROMPT =
  "你是知识问答助手。基于提供的知识条目回答用户问题，只输出 JSON：{answer: 回答文本}。{answer}";

@Injectable()
export class KnowledgeService {
  async answer(question: string): Promise<{ reply: string; citations: Citation[] }> {
    const [vec] = await embed([question]);
    let hits = await vectorSearchScoped(vec, 5);
    if (hits.length === 0) hits = await ftsSearchScoped(question, 5);
    if (hits.length === 0) {
      return { reply: "未找到相关知识，请先在 Scholar 中圈定相关内容。", citations: [] };
    }
    const citations: Citation[] = hits.map((h) => ({
      id: h.id,
      title: h.title,
      source: h.source,
      score: Math.round(h.score * 100) / 100,
    }));
    const context = hits.map((h, i) => i + 1 + ". " + h.title + "：" + h.content.slice(0, 300)).join("\n");
    const raw = await llmChat([
      { role: "system", content: ANSWER_PROMPT },
      { role: "user", content: "知识条目：\n" + context + "\n用户问题：" + question },
    ]);
    try {
      return { reply: answerSchema.parse(parseJson(raw)).answer, citations };
    } catch {
      return { reply: "基于知识库内容：" + hits.slice(0, 2).map((h) => h.title).join("、"), citations };
    }
  }
}
