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
      const outline = structure.outline as { columns?: Array<Record<string, unknown>>; groups?: { rows?: unknown[]; columns?: unknown[] } } | undefined;
      const column = outline?.columns?.find(
        (c) => String(c.indicatorName ?? "") === indicator.indicatorName && String(c.indicatorDesc ?? "") === indicator.indicatorDesc
      );
      if (!column) return finish({ applicable: false, reasonCode: "structure_invalid" });
      const userFilters = ((structure.userFilters as Array<Record<string, unknown>>) ?? []).map((f) => ({ ...f }));
      const structureFilters = ((structure.filters as Array<Record<string, unknown>>) ?? []).map((f) => ({ ...f }));
      const dateFilter = userFilters.find((f) => /date/i.test(String(f.type ?? ""))) ?? structureFilters.find((f) => /date/i.test(String(f.type ?? "")));
      if (match.timeFilter.mode !== "none" && !dateFilter) return finish({ applicable: false, reasonCode: "no_date_field" });
      if (dateFilter && match.timeFilter.mode !== "none") {
        dateFilter.operator = "between";
        dateFilter.value =
          match.timeFilter.mode === "semantic"
            ? JSON.stringify({ actualTime: true, timeFilter: match.timeFilter.enumValue ?? "THIS_MONTH" })
            : JSON.stringify({ actualTime: false, value: (match.timeFilter.from ?? "") + "," + (match.timeFilter.to ?? "") });
        if (!userFilters.includes(dateFilter)) userFilters.push(dateFilter);
      }
      const queryStructure = JSON.parse(JSON.stringify(structure)) as Record<string, unknown>;
      const qOutline = queryStructure.outline as { groups: { rows: unknown[]; columns: unknown[] } };
      qOutline.groups.rows = [];
      qOutline.groups.columns = [];
      queryStructure.userFilters = userFilters;
      const rows = await this.cybercloud.postApi<unknown>("/api/app/corm/report/queryByStructure", queryStructure);
      const rowList = Array.isArray(rows) ? rows : ((rows as { list?: unknown[] } | null | undefined)?.list ?? []);
      const first = (rowList[0] ?? {}) as Record<string, unknown>;
      const alisa = String(column.alisaName ?? column.name ?? "");
      const directHit = first[alisa];
      const sumCandidates = Object.entries(first).filter(([k]) => k.startsWith("sum_"));
      const raw = directHit !== undefined ? directHit : sumCandidates.length === 1 ? sumCandidates[0][1] : undefined;
      const value = Number(raw);
      if (!Number.isFinite(value)) return finish({ applicable: false, reasonCode: "query_failed" });
      const timePhrase = match.timeFilter.mode === "semantic"
        ? (TIME_PHRASE[match.timeFilter.enumValue ?? ""] ?? "")
        : match.timeFilter.mode === "explicit"
          ? (match.timeFilter.from ?? "") + " 至 " + (match.timeFilter.to ?? "")
          : "";
      const unit = indicator.indicatorUnit ?? "";
      return finish({
        applicable: true,
        reply: "「" + indicator.indicatorName + "」" + timePhrase + "为 " + value + unit + "（直连实时查询）",
        metricName: indicator.indicatorName,
        value,
        unit,
        timeFilter: match.timeFilter.mode === "semantic" ? match.timeFilter.enumValue : match.timeFilter.mode,
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
