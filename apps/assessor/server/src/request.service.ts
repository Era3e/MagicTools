import { Injectable, BadGatewayException, BadRequestException, NotFoundException } from "@nestjs/common";
import { appendOutbox, processOutbox } from "@mt/db";
import { idempotencyKey } from "@mt/utils";
import { GitHubClient } from "./github/client";
import { investigatorPool, pool } from "./db";
import { llmChat } from "./llm";
import {
  createRequestWithItems,
  findRequestByEventIds,
  getRequest,
  listRequestItems,
  listRequests,
  markPushed,
  setDocuments,
  setReview,
  updateRequestContext,
} from "./request.repo";

interface PushEventPayload {
  surveyId?: string;
  surveyName?: string;
  responseId?: string;
  structured?: Record<string, unknown>;
  sentiment?: string;
  priority?: string;
}

const ANALYSIS_PROMPT =
  "你是需求分析师。根据结构化调研结果与补充上下文，输出 JSON：{analysis: markdown 字符串}。markdown 结构：# 需求分析\n## 背景\n## 目标用户\n## 核心问题\n## 约束\n## 风险。只输出 JSON。输入：";
const DESIGN_PROMPT =
  "你是系统设计师。根据需求分析与仓库上下文，输出 JSON：{design: markdown 字符串}。markdown 结构：# 设计方案\n## 功能拆解\n## 技术方案\n## 验收标准\n## 工作量估算。只输出 JSON。输入：";

@Injectable()
export class RequestService {
  list(status?: string) {
    return listRequests(status);
  }

  async get(id: string) {
    const row = await getRequest(id);
    if (!row) throw new NotFoundException("分析请求不存在");
    return row;
  }

  async pollInbox() {
    let consumed = 0;
    await processOutbox(investigatorPool, async (event) => {
      if (event.event === "researcher.response.push") consumed += 1;
    });
    const events = await investigatorPool.query(
      "SELECT * FROM outbox WHERE event = 'researcher.response.push' AND status = 'done' ORDER BY occurred_at ASC"
    );
    const groups = new Map<string, { surveyName: string; eventIds: string[]; items: PushEventPayload[] }>();
    for (const row of events.rows) {
      const payload = row.payload as PushEventPayload;
      const key = payload.surveyName ?? "未命名调研";
      const g = groups.get(key) ?? { surveyName: key, eventIds: [], items: [] };
      g.eventIds.push(row.id as string);
      g.items.push(payload);
      groups.set(key, g);
    }
    let created = 0;
    let skipped = 0;
    for (const g of groups.values()) {
      const existing = await findRequestByEventIds(g.eventIds);
      if (existing) {
        skipped += 1;
        continue;
      }
      await createRequestWithItems({
        surveyName: g.surveyName,
        sourceEventIds: g.eventIds,
        items: g.items
          .filter((p) => p.responseId)
          .map((p) => ({
            responseId: p.responseId as string,
            structured: p.structured ?? {},
            sentiment: p.sentiment ?? "neutral",
            priority: p.priority ?? "P2",
          })),
      });
      created += 1;
    }
    return { consumed, created, skipped };
  }

  async updateContext(id: string, patch: { contextText?: string; repoUrl?: string }) {
    const row = await getRequest(id);
    if (!row) throw new NotFoundException("分析请求不存在");
    let repoContext = row.repoContext;
    const repoUrl = patch.repoUrl ?? row.repoUrl;
    if (repoUrl && (patch.repoUrl !== undefined || !repoContext)) {
      try {
        repoContext = (await new GitHubClient().getRepoContext(repoUrl)) as unknown as Record<string, unknown>;
      } catch (err) {
        throw new BadGatewayException("GitHub 仓库拉取失败: " + String(err));
      }
    }
    return updateRequestContext(id, {
      contextText: patch.contextText ?? row.contextText,
      repoUrl,
      repoContext,
    });
  }

  async githubStatus() {
    const token = process.env.GITHUB_TOKEN;
    if (process.env.GITHUB_STUB === "1") return { tokenConfigured: true, stub: true };
    return { tokenConfigured: Boolean(token), stub: false };
  }

  async generate(id: string) {
    const row = await getRequest(id);
    if (!row) throw new NotFoundException("分析请求不存在");
    const items = await listRequestItems(id);
    const context = {
      surveyName: row.surveyName,
      responses: items.map((i) => i.structured),
      contextText: row.contextText,
      repoUrl: row.repoUrl,
      repoContext: row.repoContext,
    };
    const analysisRaw = await llmChat([
      { role: "system", content: "你是需求分析师。只输出 JSON：{analysis: 字符串}" },
      { role: "user", content: ANALYSIS_PROMPT + JSON.stringify(context).slice(0, 12000) },
    ]);
    const analysis = JSON.parse(analysisRaw) as { analysis?: string };
    const designRaw = await llmChat([
      { role: "system", content: "你是系统设计师。只输出 JSON：{design: 字符串}" },
      { role: "user", content: DESIGN_PROMPT + JSON.stringify({ analysis: analysis.analysis ?? "", repoContext: row.repoContext }).slice(0, 12000) },
    ]);
    const design = JSON.parse(designRaw) as { design?: string };
    return setDocuments(id, { analysisMd: analysis.analysis ?? "", designMd: design.design ?? "", status: "draft" });
  }

  async review(id: string, input: { approve: boolean; comment?: string }) {
    const row = await getRequest(id);
    if (!row) throw new NotFoundException("分析请求不存在");
    if (!input.approve && !(input.comment ?? "").trim()) {
      throw new BadRequestException("驳回必须填写意见");
    }
    return setReview(id, { status: input.approve ? "approved" : "rejected", reviewComment: input.comment ?? "" });
  }

  async push(id: string) {
    const row = await getRequest(id);
    if (!row) throw new NotFoundException("分析请求不存在");
    if (row.status !== "approved") throw new BadRequestException("仅 approved 状态可推送");
    const eventId = idempotencyKey("assessor-requirement");
    await appendOutbox(pool, {
      id: eventId,
      event: "requirement.created",
      source: "assessor",
      payload: {
        requestId: row.id,
        surveyName: row.surveyName,
        analysisMd: row.analysisMd,
        designMd: row.designMd,
        repoUrl: row.repoUrl,
        reviewComment: row.reviewComment,
      },
      occurredAt: new Date().toISOString(),
    });
    await markPushed(row.id);
    return { pushed: true, eventId };
  }
}
