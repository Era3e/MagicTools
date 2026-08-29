import { Inject, Injectable } from "@nestjs/common";
import { intentConfusion, intentStats, listCorrectedLogs, type IntentLogRow } from "./intent-log.repo";
import { IntentService } from "./intent.service";
import type { Intent } from "./llm";

const ALL_INTENTS: Intent[] = [
  "product_inquiry",
  "data_query",
  "chitchat_reject",
  "process_execution",
  "trouble_shooting",
  "complaint_feedback",
];

export interface ConfusionMatrix {
  /** 预测意图 → 真实意图 → 数量 */
  matrix: Record<string, Record<string, number>>;
  labels: string[];
  /** 纠错样本总数 */
  total: number;
  /** 对角线命中数（预测 == 真实，即纠错后又改回原判定的极端情形，一般应为 0） */
  diagHits: number;
}

export interface ReplayResult {
  total: number;
  hits: number;
  /** 命中率 0~1 */
  accuracy: number;
  /** 未命中明细（predicted/actual/message 截断） */
  misses: Array<{ message: string; predicted: Intent; actual: Intent }>;
}

export interface DatasetRow {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  /** OpenAI 兼容微调格式标记 */
  weight?: number;
}

/** D-09: 由混淆对列表构造矩阵（纯函数，可单测） */
export function buildConfusionMatrix(pairs: Array<{ predicted: string; actual: string; count: number }>): ConfusionMatrix {
  const labels = [...ALL_INTENTS];
  const matrix: Record<string, Record<string, number>> = {};
  for (const p of labels) {
    matrix[p] = {};
    for (const a of labels) matrix[p][a] = 0;
  }
  let total = 0;
  let diagHits = 0;
  for (const pair of pairs) {
    if (!matrix[pair.predicted]) continue;
    if (matrix[pair.predicted][pair.actual] === undefined) continue;
    matrix[pair.predicted][pair.actual] += pair.count;
    total += pair.count;
    if (pair.predicted === pair.actual) diagHits += pair.count;
  }
  return { matrix, labels, total, diagHits };
}

/** D-09: 将已纠错日志导出为 OpenAI 兼容微调 JSONL 行（纯函数，可单测） */
export function toDatasetRow(log: IntentLogRow, systemPrompt: string): DatasetRow {
  const label = log.correctedIntent as Intent;
  return {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: log.message },
      { role: "assistant", content: JSON.stringify({ domain: log.domain, intent: label, confidence: 1 }) },
    ],
  };
}

/** D-09: JSONL 序列化（每行一个 JSON 对象） */
export function toDatasetJsonl(rows: DatasetRow[]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n");
}

@Injectable()
export class EvaluationService {
  constructor(@Inject(IntentService) private readonly intents: IntentService) {}

  /** 混淆矩阵 + 各意图纠错率 */
  async report(): Promise<{ confusion: ConfusionMatrix; stats: Array<{ intent: string; total: number; corrected: number }> }> {
    const [pairs, stats] = await Promise.all([intentConfusion(), intentStats()]);
    return { confusion: buildConfusionMatrix(pairs), stats };
  }

  /**
   * 回放评估：用当前路由器（含 few-shot 注入）对全部已纠错样本重新分类，
   * 命中率 = 预测与 corrected_intent 一致的比例 —— 路由在线学习的度量标尺。
   */
  async replay(): Promise<ReplayResult> {
    const logs = await listCorrectedLogs(500);
    let hits = 0;
    const misses: Array<{ message: string; predicted: Intent; actual: Intent }> = [];
    for (const log of logs) {
      const actual = log.correctedIntent as Intent;
      const route = await this.intents.classify(log.message);
      if (route.intent === actual) hits += 1;
      else misses.push({ message: log.message.slice(0, 60), predicted: route.intent, actual });
    }
    const total = logs.length;
    return { total, hits, accuracy: total === 0 ? 0 : hits / total, misses: misses.slice(0, 50) };
  }

  /** 导出微调数据集（JSONL 文本）；includeRaw=true 时附带原始行结构 */
  async exportDataset(): Promise<{ jsonl: string; count: number }> {
    const logs = await listCorrectedLogs(1000);
    const rows = logs.map((log) => toDatasetRow(log, INTENT_EXPORT_PROMPT));
    return { jsonl: toDatasetJsonl(rows), count: rows.length };
  }
}

const INTENT_EXPORT_PROMPT =
  "你是多系统意图路由助手，输出 {domain, intent, confidence} JSON。domain ∈ {magictools, cybercloud, chitchat}；intent ∈ {product_inquiry, data_query, chitchat_reject, process_execution, trouble_shooting, complaint_feedback}。";
