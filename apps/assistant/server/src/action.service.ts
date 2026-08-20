import { Injectable } from "@nestjs/common";
import { parseJson } from "./json";
import { llmChat } from "./llm";
import { actionSchema } from "./schemas";

const GATEWAY_URL = () => process.env.INTERNAL_GATEWAY_URL ?? "http://127.0.0.1:3000";

const ACTION_PROMPT =
  '你是平台动作解析器。从用户消息解析要执行的动作，只输出 JSON：{action: "create_requirement"|"trigger_collect", params: {title?: 需求标题, description?: 需求描述, sourceId?: 信息源ID}}。{action}';

@Injectable()
export class ActionService {
  async execute(message: string): Promise<{ reply: string; actionResult: Record<string, unknown> }> {
    const raw = await llmChat([
      { role: "system", content: ACTION_PROMPT },
      { role: "user", content: message },
    ]);
    const spec = actionSchema.parse(parseJson(raw));

    if (process.env.ACTION_STUB === "1") {
      return {
        reply: "已执行动作：" + spec.action + "（ACTION_STUB 桩模式）",
        actionResult: { ok: true, action: spec.action, stub: true },
      };
    }

    if (spec.action === "create_requirement") {
      if (!spec.params.title) {
        return { reply: "请告诉我需求标题，例如「帮我创建需求：支持导出功能」。", actionResult: { ok: false, error: "缺少标题" } };
      }
      const res = await fetch(GATEWAY_URL() + "/api/manager/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: spec.params.title, description: spec.params.description ?? "" }),
      });
      if (!res.ok) {
        return { reply: "创建需求失败：" + res.status, actionResult: { ok: false, status: res.status } };
      }
      const data = (await res.json()) as { id?: string };
      return {
        reply: "已创建需求「" + spec.params.title + "」（ID " + (data.id ?? "-") + "）",
        actionResult: { ok: true, action: "create_requirement", requirementId: data.id ?? null },
      };
    }

    if (!spec.params.sourceId) {
      return {
        reply: "请提供信息源 ID（可在 Gatherer 页面查看），例如「触发信息源 <ID> 的采集」。",
        actionResult: { ok: false, error: "缺少 sourceId" },
      };
    }
    const res = await fetch(GATEWAY_URL() + "/api/gatherer/sources/" + spec.params.sourceId + "/collect", { method: "POST" });
    if (!res.ok) {
      return { reply: "触发采集失败：" + res.status, actionResult: { ok: false, status: res.status } };
    }
    const data = (await res.json()) as { fetched?: number; new?: number };
    return {
      reply: "采集完成：抓取 " + (data.fetched ?? 0) + " 条，新增 " + (data.new ?? 0) + " 条",
      actionResult: { ok: true, action: "trigger_collect", sourceId: spec.params.sourceId, fetched: data.fetched ?? 0, new: data.new ?? 0 },
    };
  }
}
