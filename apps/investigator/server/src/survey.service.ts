import { Injectable, BadGatewayException, BadRequestException, NotFoundException } from "@nestjs/common";
import { FeishuClient } from "./feishu/client";
import { llmChat } from "./llm";
import { responseStructuredSchema } from "./schemas";
import { finishSyncRun, listResponses, startSyncRun, touchSurveySyncedAt, upsertResponse } from "./response.repo";
import { createSurvey, getSurvey, listSurveys, updateSurvey } from "./survey.repo";

const STRUCTURE_PROMPT =
  "你是需求调研分析助手。将受访者的回答结构化为 JSON：requirements（需求点数组）、painPoints（痛点数组）、expectations（期望数组）、sentiment（positive/neutral/negative）、priority（P0/P1/P2）、summary（一句话摘要）。只输出 JSON。回答：";

@Injectable()
export class SurveyService {
  list() {
    return listSurveys();
  }

  async get(id: string) {
    const row = await getSurvey(id);
    if (!row) throw new NotFoundException("调研主题不存在");
    return row;
  }

  create(input: { name: string; description?: string; appToken?: string; tableId?: string; answerFields?: string[] }) {
    if (!input.name || input.name.trim().length === 0) throw new BadRequestException("名称必填");
    return createSurvey(input);
  }

  async update(id: string, patch: Parameters<typeof updateSurvey>[1]) {
    if (patch.status && !["active", "archived"].includes(patch.status)) {
      throw new BadRequestException("非法状态: " + patch.status);
    }
    const row = await updateSurvey(id, patch);
    if (!row) throw new NotFoundException("调研主题不存在");
    return row;
  }

  async feishuStatus() {
    const client = new FeishuClient();
    if (process.env.FEISHU_STUB === "1") {
      return { configured: true, stub: true, note: "FEISHU_STUB 桩模式" };
    }
    return { configured: client.isConfigured(), stub: false };
  }

  responses(surveyId: string, filters: { sentiment?: string; priority?: string }) {
    return listResponses(surveyId, filters);
  }

  async sync(surveyId: string) {
    const survey = await getSurvey(surveyId);
    if (!survey) throw new NotFoundException("调研主题不存在");
    const runId = await startSyncRun(surveyId);
    const client = new FeishuClient();
    let fetched: Array<{ recordId: string; fields: Record<string, string[]> }> = [];
    try {
      fetched = await client.listRecords(survey.appToken, survey.tableId);
    } catch (err) {
      const message = String(err);
      await finishSyncRun(runId, { fetchedCount: 0, processedCount: 0, error: message });
      throw new BadGatewayException("飞书拉取失败: " + message);
    }
    let processed = 0;
    const answerFields = survey.answerFields ?? [];
    for (const record of fetched) {
      const answerText = answerFields
        .map((f) => (record.fields[f] ?? []).join("；"))
        .filter(Boolean)
        .join("\n");
      if (!answerText) continue;
      try {
        const raw = await llmChat([
          { role: "system", content: "只输出 JSON。" },
          { role: "user", content: STRUCTURE_PROMPT + answerText.slice(0, 3000) },
        ]);
        const structured = responseStructuredSchema.parse(JSON.parse(raw));
        await upsertResponse({
          surveyId,
          recordId: record.recordId,
          rawFields: record.fields,
          structured,
          sentiment: structured.sentiment,
          priority: structured.priority,
          summary: structured.summary,
        });
        processed += 1;
      } catch (err) {
        console.warn("[sync] 单条结构化失败: " + String(err));
      }
    }
    await touchSurveySyncedAt(surveyId);
    await finishSyncRun(runId, { fetchedCount: fetched.length, processedCount: processed });
    return { fetchedCount: fetched.length, processedCount: processed };
  }
}
