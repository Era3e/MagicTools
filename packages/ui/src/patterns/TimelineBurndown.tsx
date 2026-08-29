/**
 * TimelineBurndown — 通用迭代燃尽图 pattern
 *
 * 设计目标：
 *   - 纯 SVG 手写，零外部图表库依赖（与 @mt/ui 其他 patterns 风格一致）
 *   - 颜色/边框/文字 100% 使用 tokens，禁止硬编码色值
 *   - 算法基于 requirements.timeline 推算每日 snapshot，不要求后端提供聚合接口
 *   - 同时渲染「理想线」（total→0 线性下降）和「实际线」（按日剩余）
 *
 * 用法：
 *   import { TimelineBurndown } from "@mt/ui";
 *   <TimelineBurndown startDate="2026-08-01" endDate="2026-08-14" requirements={reqs} />
 */
import { tokens } from "../tokens";
import { useTheme } from "../theme";

/** 需求状态类型，与 manager.repo.ts REQUIREMENT_STATUSES 保持一致 */
export type BurndownStatus = "waiting" | "designing" | "todo" | "developing" | "testing" | "accepting" | "done";

/** 燃尽图最小数据单元 */
export interface BurndownRequirement {
  id: string;
  /** 当前状态（用于 timeline 为空时的 fallback） */
  status: string;
  /** 状态迁移日志，at 为 ISO 时间戳，to 为迁移后的新状态 */
  timeline: Array<{ at: string; from?: string; to: string; note?: string }>;
}

export interface TimelineBurndownProps {
  /** 迭代开始日期 YYYY-MM-DD */
  startDate: string;
  /** 迭代结束日期 YYYY-MM-DD */
  endDate: string;
  /** 该迭代下所有需求 */
  requirements: BurndownRequirement[];
  /** 标题，默认「燃尽图」 */
  title?: string;
  /** 图形总高度（含标题和坐标轴），默认 240 */
  height?: number;
  /** 覆盖色板（不传则自动取主题 token） */
  colors?: Partial<{
    ink: string;
    muted: string;
    border: string;
    area: string;
    actual: string;
    ideal: string;
  }>;
}

/** 计算两个 YYYY-MM-DD 字符串之间的天数（含两端） */
function dayDiff(start: string, end: string): number {
  const s = new Date(start + "T00:00:00").getTime();
  const e = new Date(end + "T00:00:00").getTime();
  return Math.max(1, Math.floor((e - s) / 86_400_000) + 1);
}

/** 日期加上 n 天，返回 YYYY-MM-DD */
function addDay(date: string, n: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 取较小的那个日期（今天或迭代结束） */
function clampEnd(endDate: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return endDate < today ? endDate : today;
}

/**
 * 从 requirements 推算每日剩余量。
 * 核心思路：每条需求的 timeline 给出每次状态变更时间点，
 * 把所有需求的事件合并排序，按天切 snapshot。
 */
function computeDailyRemaining(
  startDate: string,
  endDate: string,
  reqs: BurndownRequirement[],
): number[] {
  const total = reqs.length;
  if (total === 0) return [0];

  const days = dayDiff(startDate, endDate);
  const snapshots: number[] = new Array(days).fill(0);

  // 为每条需求计算它在 startDate 之前的"初始状态"
  // 规则：倒序扫描 timeline，取第一个 at <= startDate 的事件 to；否则用 status 字段
  const initialStates = reqs.map((r) => {
    const before = r.timeline.filter((t) => t.at <= startDate + "T23:59:59").pop();
    return before ? before.to : r.status;
  });

  // 第 0 天剩余 = 所有初始状态 !== 'done' 的数量
  snapshots[0] = initialStates.filter((s) => s !== "done").length;

  // 按天推进：收集当天发生的状态变更
  for (let i = 1; i < days; i++) {
    const day = addDay(startDate, i);
    snapshots[i] = snapshots[i - 1];
    for (let j = 0; j < reqs.length; j++) {
      const r = reqs[j];
      // 取 at 落在当天 [day 00:00:00, day 23:59:59] 的最后一条 timeline 事件
      const ev = r.timeline.filter((t) => t.at.slice(0, 10) === day).pop();
      if (ev) {
        const prev = initialStates[j];
        if (prev !== "done" && ev.to === "done") snapshots[i] -= 1;
        else if (prev === "done" && ev.to !== "done") snapshots[i] += 1;
        initialStates[j] = ev.to;
      }
    }
  }

  return snapshots;
}

export function TimelineBurndown({
  startDate,
  endDate,
  requirements,
  title = "燃尽图",
  height = 240,
  colors,
}: TimelineBurndownProps) {
  const theme = useTheme();
  const c = {
    ink: colors?.ink ?? theme.ink,
    muted: colors?.muted ?? theme.muted,
    border: colors?.border ?? tokens.color.border,
    area: colors?.area ?? theme.primary,
    actual: colors?.actual ?? theme.primary,
    ideal: colors?.ideal ?? tokens.color.textSecondary,
  };

  const clampedEnd = clampEnd(endDate);
  const days = dayDiff(startDate, clampedEnd);
  const total = requirements.length;
  const daily = computeDailyRemaining(startDate, clampedEnd, requirements);

  // SVG 坐标系
  const padding = { top: 18, right: 12, bottom: 24, left: 32 };
  const w = 520;
  const h = height - padding.top - padding.bottom;
  const innerW = w - padding.left - padding.right;
  const innerH = h;
  const maxY = Math.max(total, 1);

  const xFor = (dayIndex: number) => padding.left + (dayIndex / Math.max(days - 1, 1)) * innerW;
  const yFor = (remaining: number) => padding.top + innerH - (remaining / maxY) * innerH;

  // 实际线（折线 + 填充区）
  const actualPoints = daily.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
  const actualArea = daily.length > 1
    ? `M ${xFor(0)},${padding.top + innerH} L ${actualPoints.split(" ").join(" L ")} L ${xFor(daily.length - 1)},${padding.top + innerH} Z`
    : "";

  // 理想线：从 (0, total) 线性下降到 (days-1, 0) — 直接用 <line> 渲染，无需 polyline 变量

  // Y 轴刻度
  const yTicks = Math.min(4, maxY);
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((i / yTicks) * maxY));

  // X 轴标签（只标首尾和中间）
  const xLabelIndices = days <= 7
    ? days > 1 ? [0, days - 1] : [0]
    : [0, Math.floor(days / 2), days - 1];

  return (
    <div style={{ width: "100%", fontFamily: theme.bodyFont }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: c.ink, marginBottom: 4 }}>{title}</div>
      {total === 0 ? (
        <div style={{
          padding: "24px 16px",
          textAlign: "center",
          color: c.muted,
          fontSize: 12,
          border: `1px dashed ${c.border}`,
          borderRadius: tokens.radius,
        }}>
          当前迭代尚无需求，燃尽图待填充。
        </div>
      ) : (
        <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet">
          {/* 标题行 */}
          <text x={padding.left} y={12} fontSize="10" fill={c.muted} fontFamily={theme.displayFont}>
            {startDate} → {clampedEnd} · 共 {total} 项
          </text>

          {/* Y 轴网格线 + 刻度 */}
          {yTickValues.map((v, i) => {
            const y = yFor(v);
            return (
              <g key={"y" + i}>
                <line x1={padding.left} x2={w - padding.right} y1={y} y2={y} stroke={c.border} strokeDasharray="3 3" />
                <text x={padding.left - 4} y={y + 3} fontSize="10" fill={c.muted} textAnchor="end">{v}</text>
              </g>
            );
          })}

          {/* 理想线（虚线） */}
          <line
            x1={xFor(0)} y1={yFor(total)}
            x2={xFor(days - 1)} y2={yFor(0)}
            stroke={c.ideal} strokeWidth="1.5" strokeDasharray="4 3"
          />

          {/* 实际区域填充 */}
          {actualArea && (
            <path d={actualArea} fill={c.actual} fillOpacity={0.12} />
          )}

          {/* 实际线（折线） */}
          <polyline points={actualPoints} fill="none" stroke={c.actual} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {/* 数据点 */}
          {daily.map((v, i) => (
            <circle key={"pt" + i} cx={xFor(i)} cy={yFor(v)} r={2.5} fill={c.actual} />
          ))}

          {/* X 轴标签 */}
          {xLabelIndices.map((i) => (
            <text key={"x" + i} x={xFor(i)} y={height - 6} fontSize="10" fill={c.muted} textAnchor="middle">
              {addDay(startDate, i).slice(5)}
            </text>
          ))}

          {/* 图例 */}
          <g transform={`translate(${w - padding.right - 96}, ${padding.top - 2})`}>
            <line x1="0" x2="16" y1="0" y2="0" stroke={c.actual} strokeWidth="2" />
            <text x="20" y="3" fontSize="10" fill={c.muted}>实际</text>
            <line x1="50" x2="66" y1="0" y2="0" stroke={c.ideal} strokeWidth="1.5" strokeDasharray="4 3" />
            <text x="70" y="3" fontSize="10" fill={c.muted}>理想</text>
          </g>
        </svg>
      )}
    </div>
  );
}

export default TimelineBurndown;
