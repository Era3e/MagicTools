import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { parseJson } from "@mt/model-client";
import { llmChat } from "./llm";
import { interviewAnalysisSchema } from "./schemas";
import { createInterview, getInterview, listInterviews, listAllWithPosition, updateInterview, setAnalysis } from "./interview.repo";

const ANALYSIS_PROMPT =
  "你是面试复盘教练。根据面试问答记录与自我反思，输出 JSON：questions（数组：{category, question, comment}）、quality（整体回答质量点评）、suggestions（改进建议数组）、actionItems（下次面试前行动项数组）。只输出 JSON。记录：";

@Injectable()
export class InterviewService {
  list(positionId: string) {
    return listInterviews(positionId);
  }

  listAll() {
    return listAllWithPosition();
  }

  create(positionId: string, input: { round: number; happenedAt?: string; qaNotes?: string; reflection?: string; status?: "scheduled" | "done" }) {
    const status = input.status ?? "done";
    const qaNotes = input.qaNotes ?? "";
    if (status === "done" && !qaNotes.trim()) {
      throw new BadRequestException("已完成的面试必须填写问答记录");
    }
    return createInterview(positionId, { ...input, qaNotes, reflection: input.reflection ?? "", status });
  }

  async update(id: string, patch: { happenedAt?: string; status?: "scheduled" | "done" }) {
    if (patch.status && !["scheduled", "done"].includes(patch.status)) {
      throw new BadRequestException("非法面试状态: " + patch.status);
    }
    if (patch.happenedAt === undefined && patch.status === undefined) {
      throw new BadRequestException("至少提供 happenedAt 或 status 之一");
    }
    const row = await updateInterview(id, patch);
    if (!row) throw new NotFoundException("面试记录不存在");
    return row;
  }

  async analyze(id: string) {
    const row = await getInterview(id);
    if (!row) throw new NotFoundException("面试记录不存在");
    const raw = await llmChat([
      { role: "system", content: "只输出 JSON。" },
      { role: "user", content: ANALYSIS_PROMPT + JSON.stringify({ round: row.round, qaNotes: row.qaNotes, reflection: row.reflection }) },
    ]);
    const analysis = interviewAnalysisSchema.parse(parseJson(raw));
    return setAnalysis(id, analysis);
  }

  async exportMarkdown(id: string): Promise<string> {
    const row = await getInterview(id);
    if (!row) throw new NotFoundException("面试记录不存在");
    const lines: string[] = [];
    lines.push("# 面试复盘");
    lines.push("");
    lines.push("- 轮次: 第 " + row.round + " 面");
    lines.push("- 时间: " + row.happenedAt);
    lines.push("");
    lines.push("## 问答记录");
    lines.push("");
    lines.push(row.qaNotes || "（无）");
    lines.push("");
    lines.push("## 自我反思");
    lines.push("");
    lines.push(row.reflection || "（无）");
    if (row.analysis) {
      const a = row.analysis as {
        quality?: string;
        suggestions?: string[];
        actionItems?: string[];
        questions?: Array<{ category: string; question: string; comment: string }>;
      };
      lines.push("");
      lines.push("## 分析结论");
      lines.push("");
      if (a.quality) lines.push(a.quality);
      if (a.questions?.length) {
        lines.push("");
        lines.push("### 问题清单");
        for (const q of a.questions) lines.push("- [" + q.category + "] " + q.question + " — " + q.comment);
      }
      if (a.suggestions?.length) {
        lines.push("");
        lines.push("### 改进建议");
        for (const s of a.suggestions) lines.push("- " + s);
      }
      if (a.actionItems?.length) {
        lines.push("");
        lines.push("### 行动项");
        for (const t of a.actionItems) lines.push("- [ ] " + t);
      }
    }
    return lines.join("\n");
  }
}
