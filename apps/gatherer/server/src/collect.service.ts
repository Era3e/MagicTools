import { BadGatewayException, Injectable, NotFoundException } from "@nestjs/common";
import { appendOutbox } from "@mt/db";
import { contentFingerprint, idempotencyKey } from "@mt/utils";
import { parseJson } from "@mt/model-client";
import { pool } from "./db";
import { parseFeed, type ParsedItem } from "./feed/parser";
import { finishRun, listItems, markPushed, startRun, upsertItem, markRunDead } from "./item.repo";
import { llmChat } from "./llm";
import { enrichSchema } from "./schemas";
import { getSource, touchRun } from "./source.repo";

const ENRICH_PROMPT = "你是信息分类助手。输出 JSON：{summary: 一句话摘要, category: 行业分类, keywords: 关键词数组(最多5个)}。只输出 JSON。内容：";

/** 采集最大重试次数（指数退避：1s → 2s → 4s → 8s → 16s） */
const MAX_ATTEMPTS = 5;

@Injectable()
export class CollectService {
  async collect(sourceId: string) {
    const source = await getSource(sourceId);
    if (!source) throw new NotFoundException("信息源不存在");
    const runId = await startRun(sourceId);
    let items: ParsedItem[] = [];
    try {
      items = await parseFeed(source as never);
    } catch (err) {
      // D-12: 指数退避重试（最多 MAX_ATTEMPTS 次）
      let lastErr: unknown = err;
      for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, 8s
        await new Promise((r) => setTimeout(r, delay));
        try {
          items = await parseFeed(source as never);
          lastErr = null;
          break;
        } catch (retryErr) {
          lastErr = retryErr;
          console.warn("[collect] 第 " + (attempt + 1) + " 次重试失败: " + String(retryErr));
        }
      }
      if (lastErr) {
        // 达到最大重试 → 标为 dead + 发告警
        await markRunDead(runId, String(lastErr));
        await this.fireDeadLetterAlert(sourceId, runId, String(lastErr));
        throw new BadGatewayException("采集失败（已重试 " + MAX_ATTEMPTS + " 次）: " + String(lastErr));
      }
    }
    let created = 0;
    const options = source.options as { llm?: boolean; autoPush?: boolean };
    const llmOn = options?.llm !== false;
    const insertedIds: string[] = [];
    for (const item of items) {
      const fingerprint = contentFingerprint(item.url + "|" + item.title);
      let enriched = { summary: "", category: "", keywords: [] as string[] };
      if (llmOn) {
        try {
          const raw = await llmChat([
            { role: "system", content: "输出 JSON：{summary: 字符串, category: 字符串, keywords: 数组}" },
            { role: "user", content: ENRICH_PROMPT + (item.title + "\n" + item.content).slice(0, 3000) },
          ]);
          enriched = enrichSchema.parse(parseJson(raw));
        } catch (err) {
          console.warn("[collect] 富化失败: " + String(err));
        }
      }
      const inserted = await upsertItem({
        sourceId,
        url: item.url,
        title: item.title,
        content: item.content.slice(0, 10000),
        publishedAt: item.publishedAt,
        fingerprint,
        category: enriched.category,
        keywords: enriched.keywords,
        summary: enriched.summary,
        llmEnriched: llmOn,
      });
      if (inserted) created += 1;
    }
    await touchRun(sourceId);
    await finishRun(runId, { fetchedCount: items.length, newCount: created });
    if (options?.autoPush && insertedIds.length > 0) {
      await this.push(insertedIds);
    }
    return { fetched: items.length, new: created, skipped: items.length - created };
  }

  items(filters: { sourceId?: string; pushed?: string }) {
    return listItems(filters);
  }

  /** D-12: 死信告警 — 通过 outbox 发出 gatherer.collect.dead_letter 事件 */
  private async fireDeadLetterAlert(sourceId: string, runId: string, error: string): Promise<void> {
    console.error("[collect] 死信告警: source=" + sourceId + " run=" + runId + " error=" + error);
    try {
      await appendOutbox(pool, {
        id: idempotencyKey("gatherer-dead-letter-" + runId),
        event: "gatherer.collect.dead_letter",
        source: "gatherer",
        payload: { sourceId, runId, error, maxAttempts: MAX_ATTEMPTS },
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // outbox 写入失败不影响主流程
    }
  }

  async push(ids: string[]) {
    const items = await listItems();
    const targets = items.filter((i) => ids.includes(i.id));
    const eventIds: string[] = [];
    for (const item of targets) {
      const eventId = idempotencyKey("gatherer-item-push");
      await appendOutbox(pool, {
        id: eventId,
        event: "knowledge.item.collected",
        source: "gatherer",
        payload: {
          itemId: item.id,
          url: item.url,
          title: item.title,
          content: item.content,
          summary: item.summary,
          category: item.category,
          keywords: item.keywords,
          publishedAt: item.publishedAt,
        },
        occurredAt: new Date().toISOString(),
      });
      eventIds.push(eventId);
    }
    await markPushed(targets.map((i) => i.id));
    return { pushedCount: targets.length, eventIds };
  }
}
