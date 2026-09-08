import { Inject, Injectable } from "@nestjs/common";
import { parseJson } from "./json";
import { llmChat } from "./llm";
import { CybercloudService } from "./cybercloud.service";
import { directMatchSchema, type DirectMatch } from "./schemas";

const LIST_TTL_MS = 10 * 60 * 1000;

interface IndicatorItem {
  id: string;
  indicatorName: string;
  indicatorDesc: string;
  indicatorUnit: string;
  reportId: string;
  reportName: string;
}

const TIME_PHRASE: Record<string, string> = {
  THIS_MONTH: "本月", PRE_MONTH: "上月", THIS_WEEK: "本周", PRE_WEEK: "上周",
  TODAY: "今日", PAST_7_DAYS: "近7天", PAST_30_DAYS: "近30天", THIS_YEAR: "今年", PRE_YEAR: "去年",
};

export type DirectReasonCode = "no_match" | "low_confidence" | "no_date_field" | "structure_invalid" | "query_failed" | "timeout" | "unconfigured";

export type DirectResult =
  | { applicable: true; reply: string; metricName: string; value: number; unit?: string; timeFilter?: string; endpoint?: string; latencyMs: number }
  | { applicable: false; reasonCode: DirectReasonCode; latencyMs: number };

type DirectFinishPayload =
  | Omit<Extract<DirectResult, { applicable: true }>, "latencyMs">
  | Omit<Extract<DirectResult, { applicable: false }>, "latencyMs">;

@Injectable()
export class DirectQueryService {
  private listCache: { at: number; items: IndicatorItem[] } | null = null;

  constructor(@Inject(CybercloudService) private readonly cybercloud: CybercloudService) {}

  private configured(): boolean {
    return Boolean(process.env.CYBERCLOUD_BASE_URL && process.env.CYBERCLOUD_API_KEY);
  }

  async run(message: string): Promise<DirectResult> {
    const started = Date.now();
    const finish = (r: DirectFinishPayload): DirectResult => ({ ...r, latencyMs: Date.now() - started });
    if (!this.configured() && process.env.CYBERCLOUD_STUB !== "1") return finish({ applicable: false, reasonCode: "unconfigured" });
    if (process.env.CYBERCLOUD_STUB === "1") {
      if (process.env.CYBERCLOUD_STUB_DIRECT_APPLICABLE === "0") {
        return finish({ applicable: false, reasonCode: "no_match" });
      }
      return finish({ applicable: true, reply: "「本月销售额」本月为 12345 元（直连实时查询）", metricName: "本月销售额", value: 12345, unit: "元", timeFilter: "THIS_MONTH", endpoint: "stub" });
    }
    const timeoutMs = Number(process.env.CYBERCLOUD_DIRECT_TIMEOUT_MS ?? "8000");
    const timeout = new Promise<DirectResult>((resolve) =>
      setTimeout(() => resolve(finish({ applicable: false, reasonCode: "timeout" })), timeoutMs)
    );
    return Promise.race([this.pipeline(message, finish), timeout]);
  }

  private async pipeline(message: string, finish: (r: DirectFinishPayload) => DirectResult): Promise<DirectResult> {
    try {
      const indicators = await this.listIndicators();
      if (indicators.length === 0) return finish({ applicable: false, reasonCode: "no_match" });
      const match = await this.matchMetric(message, indicators);
      if (!match || !match.metricId || match.confidence < 0.6) {
        return finish({ applicable: false, reasonCode: match && match.metricId ? "low_confidence" : "no_match" });
      }
      const indicator = indicators.find((i) => i.id === match.metricId);
      if (!indicator) return finish({ applicable: false, reasonCode: "no_match" });
      let structure = await this.cybercloud.postApi<Record<string, unknown>>("/api/setup/report/getReportStructure", { reportId: indicator.reportId });
      if (typeof structure === "string") {
        try { structure = JSON.parse(structure) as Record<string, unknown>; } catch { return finish({ applicable: false, reasonCode: "structure_invalid" }); }
      }
      if (!structure) return finish({ applicable: false, reasonCode: "structure_invalid" });
      const outline = structure.outline as { columns?: Array<Record<string, unknown>>; groups?: { rows?: Array<Record<string, unknown>>; columns?: unknown[] } } | undefined;
      const column = outline?.columns?.find(
        (c) => String(c.indicatorName ?? "") === indicator.indicatorName && String(c.indicatorDesc ?? "") === indicator.indicatorDesc
      );
      if (!column) return finish({ applicable: false, reasonCode: "structure_invalid" });
      const userFilters = ((structure.userFilters as Array<Record<string, unknown>>) ?? []).map((f) => ({ ...f }));
      const structureFilters = ((structure.filters as Array<Record<string, unknown>>) ?? []).map((f) => ({ ...f }));
      const groupRows = (outline?.groups?.rows ?? []).map((r) => ({ ...r }));
      // 日期过滤骨架探测（真环境实证）：优先过滤器，其次行分组字段（type=date/datetime）——
      // testcybercloud-dev 实测 userFilters/filters 常为空，日期字段只出现在行分组（SalesDate DAY 等）
      let dateFilter: Record<string, unknown> | undefined =
        userFilters.find((f) => /date/i.test(String(f.type ?? ""))) ?? structureFilters.find((f) => /date/i.test(String(f.type ?? "")));
      if (!dateFilter) {
        const groupDate = groupRows.find((r) => /date/i.test(String(r.type ?? "")));
        if (groupDate) {
          dateFilter = {
            id: groupDate.id ?? String(groupDate.table ?? "") + "." + String(groupDate.code ?? ""),
            code: groupDate.code,
            table: groupDate.table,
            name: groupDate.name,
            type: groupDate.type,
            operator: "between",
          };
        }
      }
      if (match.timeFilter.mode !== "none" && !dateFilter) return finish({ applicable: false, reasonCode: "no_date_field" });
      const enumValue = match.timeFilter.enumValue ?? undefined;
      const fromValue = match.timeFilter.from ?? undefined;
      const toValue = match.timeFilter.to ?? undefined;
      if (dateFilter && match.timeFilter.mode !== "none") {
        dateFilter.operator = "between";
        dateFilter.value =
          match.timeFilter.mode === "semantic"
            ? JSON.stringify({ actualTime: true, timeFilter: enumValue ?? "THIS_MONTH" })
            : JSON.stringify({ actualTime: false, value: (fromValue ?? "") + "," + (toValue ?? "") });
        if (!userFilters.includes(dateFilter)) userFilters.push(dateFilter);
      }
      const queryStructure = JSON.parse(JSON.stringify(structure)) as Record<string, unknown>;
      const qOutline = queryStructure.outline as { groups: { rows: unknown[]; columns: unknown[] } };
      qOutline.groups.rows = [];
      qOutline.groups.columns = [];
      queryStructure.userFilters = userFilters;
      const rows = await this.cybercloud.postApi<unknown>("/api/app/corm/report/queryByStructure", queryStructure);
      // 真环境实证响应为包裹对象 { data, rows, grandTotals, ... }——单值在 data[0]；兼容裸数组（旧假设）
      const wrapped = rows as { data?: unknown[] } | null | undefined;
      const rowList = Array.isArray(rows) ? rows : (Array.isArray(wrapped?.data) ? wrapped!.data! : ((rows as { list?: unknown[] } | null | undefined)?.list ?? []));
      const first = (rowList[0] ?? {}) as Record<string, unknown>;
      // 取值键优先级（真环境实证多列并存：count_/sum_/avg_/max_ 同码不同聚合 + _cbc_calculation_N 计算列）：
      // ①精确键 {summarize}_{table}_{code}（指标列自身定义，唯一）②alisaName 命中 ③唯一 sum_ 前缀兜底
      const summarize = String(column.summarize ?? "");
      const preciseKey = summarize && column.table && column.code ? summarize + "_" + String(column.table) + "_" + String(column.code) : "";
      const alisa = String(column.alisaName ?? column.name ?? "");
      const directHit = (preciseKey && first[preciseKey] !== undefined ? first[preciseKey] : undefined) ?? (alisa ? first[alisa] : undefined);
      const sumCandidates = Object.entries(first).filter(([k]) => k.startsWith("sum_"));
      const raw = directHit !== undefined ? directHit : sumCandidates.length === 1 ? sumCandidates[0][1] : undefined;
      const unit = indicator.indicatorUnit ?? "";
      const value = Number(raw);
      // 真环境实证：本月等时间窗无数据时，sum 聚合列会整体省略（只剩 count_* 列且为 0）——
      // 属「查询成功但无数据」，如实回答 0 而非 query_failed（不硬造、不误报故障）
      if (!Number.isFinite(value)) {
        const countKeys = Object.keys(first).filter((k) => k.startsWith("count_"));
        const anyCount = countKeys.map((k) => Number(first[k])).find((n) => Number.isFinite(n));
        if (rowList.length > 0 && anyCount !== undefined && anyCount <= 0) {
          return finish({
            applicable: true,
            reply: "「" + indicator.indicatorName + "」" + (match.timeFilter.mode === "semantic" ? (TIME_PHRASE[enumValue ?? ""] ?? "") : "") + "为 0" + unit + "（直连实时查询：该时间范围内无数据）",
            metricName: indicator.indicatorName,
            value: 0,
            unit,
            timeFilter: match.timeFilter.mode === "semantic" ? enumValue : match.timeFilter.mode,
            endpoint: "queryByStructure",
          });
        }
        return finish({ applicable: false, reasonCode: "query_failed" });
      }
      const timePhrase = match.timeFilter.mode === "semantic"
        ? (TIME_PHRASE[enumValue ?? ""] ?? "")
        : match.timeFilter.mode === "explicit"
          ? (fromValue ?? "") + " 至 " + (toValue ?? "")
          : "";
      return finish({
        applicable: true,
        reply: "「" + indicator.indicatorName + "」" + timePhrase + "为 " + value + unit + "（直连实时查询）",
        metricName: indicator.indicatorName,
        value,
        unit,
        timeFilter: match.timeFilter.mode === "semantic" ? enumValue : match.timeFilter.mode,
        endpoint: "queryByStructure",
      });
    } catch {
      return finish({ applicable: false, reasonCode: "query_failed" });
    }
  }

  private async listIndicators(): Promise<IndicatorItem[]> {
    if (this.listCache && Date.now() - this.listCache.at < LIST_TTL_MS) return this.listCache.items;
    const data = await this.cybercloud.postApi<IndicatorItem[]>("/api/setup/report/indicators/list", {});
    const items = (data ?? []).filter((i) => i.id && i.reportId);
    this.listCache = { at: Date.now(), items };
    return items;
  }

  private async matchMetric(message: string, indicators: IndicatorItem[]): Promise<DirectMatch | null> {
    const catalog = indicators.map((i) => ({ id: i.id, name: i.indicatorName, desc: i.indicatorDesc, unit: i.indicatorUnit, report: i.reportName }));
    const raw = await llmChat([
      { role: "system", content: "从指标目录中匹配用户问题要查的指标并解析时间范围。只输出 JSON：{metricId, confidence, timeFilter:{mode:semantic|explicit|none, enumValue, from, to}}。{metricId} 指标目录：" + JSON.stringify(catalog) },
      { role: "user", content: message },
    ]);
    const parsed = directMatchSchema.safeParse(parseJson(raw));
    return parsed.success ? parsed.data : null;
  }
}
