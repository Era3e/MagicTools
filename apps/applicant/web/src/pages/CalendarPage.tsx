import { Button, Skeleton, message } from "antd";
import { ClockCircleOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type InterviewWithPosition, type Position } from "../api";
import { MtEmptyState, MtStatusTag, tokens, useTheme, type MtStatusTagTone } from "@mt/ui";
import { POSITION_STATUS_LABELS, POSITION_STATUS_TONE } from "../status";
import { buildFollowUps, buildTimeline, cnNum, computeKpi, monthMatrix, todayYmd, type EventKind } from "./calendar-view";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const KIND_LABEL: Record<EventKind, string> = { applied: "投递", scheduled: "面试", interviewed: "已完成" };
const KIND_TONE: Record<EventKind, MtStatusTagTone> = { applied: "neutral", scheduled: "info", interviewed: "neutral" };
const pad2 = (n: number) => String(n).padStart(2, "0");

export default function CalendarPage() {
  const navigate = useNavigate();
  const [positions, setPositions] = useState<Position[]>([]);
  const [interviews, setInterviews] = useState<InterviewWithPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const theme = useTheme();
  const MAG = {
    ink: theme.ink,
    accent: theme.accent ?? theme.primary,
    tint: theme.tint ?? theme.paper ?? theme.background,
    muted: theme.muted,
    panel: theme.panel ?? theme.card ?? "#ffffff",
    border: theme.border ?? theme.rule,
    display: theme.displayFont,
    sans: theme.bodyFont,
  };
  const cssVars = {
    "--cal-accent": MAG.accent,
    "--cal-tint": MAG.tint,
    "--cal-ink": MAG.ink,
    "--cal-muted": MAG.muted,
    "--cal-panel": MAG.panel,
    "--cal-border": MAG.border,
    "--cal-hairline": tokens.craft.hairline,
    "--cal-hairline-strong": tokens.craft.hairlineStrong,
    "--cal-surface2": tokens.color.bgUser,
    "--cal-surface0": tokens.color.bgLayout,
    "--cal-info": tokens.color.info,
    "--cal-error": tokens.color.error,
    "--cal-error-bg": tokens.scale.error[0],
    "--cal-error-text": tokens.scale.error[7],
    "--cal-graphite4": tokens.scale.graphite[4],
    "--cal-ink6": tokens.scale.ink[6],
    "--cal-font-display": MAG.display,
    "--cal-font-body": MAG.sans,
    "--cal-font-mono": tokens.font.mono,
  } as React.CSSProperties;

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([api.listPositions(), api.listAllInterviews()])
      .then(([ps, ivs]) => {
        setPositions(ps);
        setInterviews(ivs);
      })
      .catch((err) => message.error(String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const today = todayYmd();
  const nodes = useMemo(() => buildTimeline(positions, interviews, today), [positions, interviews, today]);
  const kpi = useMemo(() => computeKpi(positions, interviews, today), [positions, interviews, today]);
  const followUps = useMemo(() => buildFollowUps(positions, interviews, today), [positions, interviews, today]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof nodes>();
    for (const n of nodes) map.set(n.ymd, [...(map.get(n.ymd) ?? []), n]);
    return map;
  }, [nodes]);
  const cells = useMemo(() => monthMatrix(cursor.year, cursor.month), [cursor]);
  const companyCount = useMemo(() => new Set(nodes.map((n) => n.positionId)).size, [nodes]);
  const nextScheduled = useMemo(
    () => nodes.find((n) => n.kind === "scheduled" && n.dday >= 0 && n.dday <= 3) ?? null,
    [nodes]
  );
  const hasData = positions.length > 0 || interviews.length > 0;

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const openNode = (n: (typeof nodes)[number]) => {
    navigate(n.kind === "applied" ? `/positions/${n.positionId}` : `/positions/${n.positionId}/interviews`);
  };

  return (
    <div className="pg-cal" style={{ ...cssVars, fontFamily: MAG.sans, color: MAG.ink }}>
      <style>{`
.pg-cal { display: flex; flex-direction: column; gap: 48px; }
.pg-cal-hero { display: flex; flex-direction: column; gap: 16px; padding-bottom: 32px; border-bottom: 1px solid var(--cal-hairline-strong); }
.pg-cal-vol { font-family: var(--cal-font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cal-accent); }
.pg-cal-title { margin: 0; font-family: var(--cal-font-display); font-size: 28px; font-weight: 600; line-height: 1.25; letter-spacing: 0.01em; color: var(--cal-ink); }
.pg-cal-hero-sub { margin: 0; max-width: 640px; font-size: 15px; line-height: 1.75; color: var(--cal-muted); }
.pg-cal-readouts { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 0; margin-top: 4px; }
.pg-cal-readout { display: inline-flex; align-items: baseline; gap: 6px; font-family: var(--cal-font-mono); font-size: 12px; font-weight: 500; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; color: var(--cal-muted); white-space: nowrap; }
.pg-cal-readout--mast { margin-right: 16px; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.72; }
.pg-cal-readout--data { padding-left: 16px; margin-right: 16px; border-left: 1px solid var(--cal-hairline-strong); }
.pg-cal-readout b { font-family: var(--cal-font-mono); font-size: 14px; font-weight: 600; color: var(--cal-accent); }
.pg-cal-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.pg-cal-sec-title { margin: 0; display: inline-flex; align-items: baseline; gap: 12px; font-family: var(--cal-font-display); font-size: 22px; font-weight: 600; line-height: 1.35; color: var(--cal-ink); }
.pg-cal-sec-no { font-family: var(--cal-font-mono); font-size: 12px; font-weight: 600; letter-spacing: 0.06em; color: var(--cal-accent); }
.pg-cal-sec-meta { font-family: var(--cal-font-mono); font-size: 12px; font-weight: 500; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; opacity: 0.62; white-space: nowrap; }
.pg-cal-board { display: grid; grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr); gap: 32px; align-items: start; }
.pg-cal-rail { position: sticky; top: 84px; }
.pg-cal-node-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--cal-hairline-strong); }
.pg-cal-node { display: grid; grid-template-columns: 88px minmax(0, 1fr) auto auto; align-items: center; column-gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--cal-hairline); }
.pg-cal-dday { font-family: var(--cal-font-mono); font-size: 15px; font-weight: 500; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; color: var(--cal-muted); white-space: nowrap; }
.pg-cal-node--soon .pg-cal-dday { font-weight: 600; color: var(--cal-accent); }
.pg-cal-node--done .pg-cal-dday { opacity: 0.55; }
.pg-cal-node--done .pg-cal-node-title { color: var(--cal-muted); }
.pg-cal-node-job { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pg-cal-node-title { font-size: 15px; font-weight: 600; line-height: 1.45; color: var(--cal-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pg-cal-node-org { font-family: var(--cal-font-mono); font-size: 13px; font-weight: 500; letter-spacing: 0.01em; color: var(--cal-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pg-cal-node-type { display: inline-flex; justify-self: start; }
.pg-cal-node-action { justify-self: end; }
.pg-cal-link { font-size: 13px; font-weight: 600; color: var(--cal-ink); background: none; border: none; padding: 0; cursor: pointer; border-bottom: 1px solid transparent; transition: color 120ms cubic-bezier(0.4,0,0.2,1), border-color 120ms cubic-bezier(0.4,0,0.2,1); font-family: inherit; }
.pg-cal-link:hover { color: var(--cal-accent); border-bottom-color: var(--cal-accent); }
.pg-cal-link:focus-visible { outline: 2px solid var(--cal-accent); outline-offset: 2px; }
.pg-cal-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.pg-cal-month { font-family: var(--cal-font-mono); font-size: 13px; font-weight: 600; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; color: var(--cal-ink); }
.pg-cal-nav { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: transparent; border: 1px solid var(--cal-hairline-strong); border-radius: 4px; color: var(--cal-muted); cursor: pointer; transition: background-color 120ms cubic-bezier(0.4,0,0.2,1), color 120ms cubic-bezier(0.4,0,0.2,1); }
.pg-cal-nav:hover { background: var(--cal-surface2); color: var(--cal-ink); }
.pg-cal-nav:focus-visible { outline: 2px solid var(--cal-accent); outline-offset: 2px; }
.pg-cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 1px; background: var(--cal-hairline); border: 1px solid var(--cal-hairline); border-radius: 6px; overflow: hidden; }
.pg-cal-dow { display: flex; align-items: center; justify-content: center; padding: 8px 0; background: var(--cal-surface2); font-family: var(--cal-font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: var(--cal-muted); }
.pg-cal-cell { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 2px; min-height: 44px; padding: 8px 0 4px; background: var(--cal-panel); border: none; font: inherit; }
.pg-cal-cell--empty { background: var(--cal-surface0); }
.pg-cal-cell--click { cursor: pointer; }
.pg-cal-day { font-family: var(--cal-font-mono); font-size: 12px; font-weight: 500; line-height: 1.4; font-variant-numeric: tabular-nums; color: var(--cal-ink); }
.pg-cal-cell--today { background: var(--cal-tint); }
.pg-cal-cell--today .pg-cal-day { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 4px; background: var(--cal-accent); border-radius: 4px; color: var(--cal-panel); font-weight: 600; }
.pg-cal-dot { width: 5px; height: 5px; border-radius: 9999px; }
.pg-cal-dot--applied { background: var(--cal-graphite4); }
.pg-cal-dot--scheduled { background: var(--cal-info); }
.pg-cal-dot--interviewed { background: var(--cal-ink6); }
.pg-cal-legend { display: flex; flex-wrap: wrap; gap: 8px 16px; margin-top: 12px; }
.pg-cal-legend-item { display: inline-flex; align-items: center; gap: 6px; font-family: var(--cal-font-mono); font-size: 11px; font-weight: 500; letter-spacing: 0.02em; color: var(--cal-muted); white-space: nowrap; }
.pg-cal-legend-dot { width: 6px; height: 6px; border-radius: 9999px; }
.pg-cal-urgent { display: flex; align-items: flex-start; gap: 12px; margin-top: 16px; padding: 12px 16px; background: var(--cal-error-bg); border: 1px solid var(--cal-error); border-radius: 6px; }
.pg-cal-urgent .anticon { font-size: 16px; flex: none; margin-top: 2px; color: var(--cal-error); }
.pg-cal-urgent-dday { font-family: var(--cal-font-mono); font-size: 14px; font-weight: 600; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; color: var(--cal-error-text); white-space: nowrap; }
.pg-cal-urgent-text { font-size: 13px; line-height: 1.65; color: var(--cal-error-text); }
.pg-cal-urgent-text b { font-weight: 700; }
.pg-cal-companies { border-top: 1px solid var(--cal-hairline-strong); padding-top: 24px; }
.pg-cal-company-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
.pg-cal-company { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 16px; background: var(--cal-panel); border: 1px solid var(--cal-hairline); border-radius: 6px; text-align: left; cursor: pointer; transition: border-color 120ms cubic-bezier(0.4,0,0.2,1); font-family: inherit; }
.pg-cal-company:hover { border-color: var(--cal-hairline-strong); }
.pg-cal-company:focus-visible { outline: 2px solid var(--cal-accent); outline-offset: 2px; }
.pg-cal-company-org { font-family: var(--cal-font-display); font-size: 15px; font-weight: 600; line-height: 1.4; color: var(--cal-ink); }
.pg-cal-company-role { font-size: 13px; line-height: 1.5; color: var(--cal-muted); }
.pg-cal-followup { border-top: 1px solid var(--cal-hairline-strong); padding-top: 24px; }
.pg-cal-followup-list { display: flex; flex-direction: column; }
.pg-cal-followup-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--cal-hairline); }
.pg-cal-followup-days { font-family: var(--cal-font-mono); font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--cal-error-text); white-space: nowrap; }
.pg-cal-followup-label { font-size: 13px; color: var(--cal-ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 860px) {
  .pg-cal-board { grid-template-columns: minmax(0, 1fr); }
  .pg-cal-rail { order: -1; position: static; }
  .pg-cal-hero-sub { max-width: none; }
}
@media (max-width: 720px) {
  .pg-cal-node { grid-template-columns: 88px minmax(0, 1fr) auto; row-gap: 8px; }
  .pg-cal-node-type { grid-column: 1 / 2; }
  .pg-cal-node-action { grid-column: 2 / -1; justify-self: start; }
}
@media (max-width: 640px) {
  .pg-cal { gap: 24px; }
  .pg-cal-readouts { gap: 8px 0; }
  .pg-cal-sec-head { flex-direction: column; gap: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .pg-cal-link, .pg-cal-nav, .pg-cal-company { transition: none; }
}
`}</style>

      {/* Hero · D-day 读数带 */}
      <section className="pg-cal-hero" aria-labelledby="pg-cal-hero-title">
        <div className="pg-cal-vol" data-testid="cal-eyebrow">TIMELINE · {today.slice(0, 7)}</div>
        <h1 className="pg-cal-title" id="pg-cal-hero-title">
          {kpi.windowDays !== null ? `${cnNum(kpi.windowDays)} 天窗口` : "投递节奏，一目了然"}
        </h1>
        <p className="pg-cal-hero-sub">
          {companyCount > 0
            ? `${companyCount} 家公司、${nodes.length} 枚节点摊在同一张月历上：${
                nextScheduled
                  ? `最近的一场面试在${nextScheduled.dday === 0 ? "今天" : cnNum(nextScheduled.dday) + " 天后"}。`
                  : "投递、面试与复盘，节奏一览无余。"
              }`
            : "投递岗位或记录面试后，这里会汇集你的全部节奏。"}
        </p>
        <div className="pg-cal-readouts">
          <span className="pg-cal-readout pg-cal-readout--mast">投递读数</span>
          <span className="pg-cal-readout pg-cal-readout--data">跟踪岗位 <b>{kpi.active}</b></span>
          <span className="pg-cal-readout pg-cal-readout--data">七日内节点 <b>{kpi.upcoming7d}</b></span>
          <span className="pg-cal-readout pg-cal-readout--data">
            最近截止 <b>{kpi.windowDays !== null ? `D-${pad2(kpi.windowDays)}` : "—"}</b>
          </span>
          <span className="pg-cal-readout pg-cal-readout--data">本月已了结 <b>{kpi.closedThisMonth}</b></span>
        </div>
      </section>

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : !hasData ? (
        <div data-testid="cal-empty">
          <MtEmptyState
            title="还没有可展示的动态"
            description="投递岗位或记录面试后，日历会自动汇集"
            actionText="去岗位博览"
            onAction={() => navigate("/positions")}
          />
        </div>
      ) : (
        <>
          {/* 两栏棋盘：时间轴（左）+ 月历（右） */}
          <div className="pg-cal-board">
            <section aria-labelledby="pg-cal-nodes-title">
              <div className="pg-cal-sec-head">
                <h2 className="pg-cal-sec-title" id="pg-cal-nodes-title">
                  <span className="pg-cal-sec-no">01</span>按 D-day 排序的节点清单
                </h2>
                <span className="pg-cal-sec-meta">
                  {nodes.length} 节点 · {companyCount} 公司
                </span>
              </div>
              <ol className="pg-cal-node-list">
                {nodes.map((n) => {
                  const soon = n.dday >= 0 && n.dday <= 3;
                  const done = n.dday < 0;
                  return (
                    <li
                      key={n.ymd + n.kind + n.positionId + n.title}
                      className={soon ? "pg-cal-node pg-cal-node--soon" : done ? "pg-cal-node pg-cal-node--done" : "pg-cal-node"}
                    >
                      <span className="pg-cal-dday" aria-label={n.dday >= 0 ? `${n.dday} 天后` : `${-n.dday} 天前`}>
                        {n.dday >= 0 ? `D-${pad2(n.dday)}` : `D+${pad2(-n.dday)}`}
                      </span>
                      <span className="pg-cal-node-job">
                        <span className="pg-cal-node-title">{n.title}</span>
                        <span className="pg-cal-node-org">{n.org}</span>
                      </span>
                      <span className="pg-cal-node-type">
                        <MtStatusTag tone={KIND_TONE[n.kind]}>{KIND_LABEL[n.kind]}</MtStatusTag>
                      </span>
                      <span className="pg-cal-node-action">
                        <button type="button" className="pg-cal-link" onClick={() => openNode(n)}>
                          {n.kind === "scheduled" ? "面试复盘" : "进度详情"}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>

            <aside className="pg-cal-rail" aria-label="本月投递日历">
              <div className="pg-cal-head">
                <button type="button" className="pg-cal-nav" aria-label="上一月" onClick={() => shiftMonth(-1)}>
                  <LeftOutlined />
                </button>
                <span className="pg-cal-month" data-testid="cal-month-label">
                  {cursor.year}-{pad2(cursor.month + 1)}
                </span>
                <button type="button" className="pg-cal-nav" aria-label="下一月" onClick={() => shiftMonth(1)}>
                  <RightOutlined />
                </button>
                <Button size="small" type="text" onClick={() => {
                  const d = new Date();
                  setCursor({ year: d.getFullYear(), month: d.getMonth() });
                }}>
                  回到本月
                </Button>
              </div>
              <div className="pg-cal-grid" data-testid="cal-month-grid" aria-label={`${cursor.year} 年 ${cursor.month + 1} 月投递节点日历，周一为每周第一天`}>
                {WEEKDAYS.map((w) => (
                  <span key={w} className="pg-cal-dow">{w}</span>
                ))}
                {cells.map((date, idx) => {
                  if (!date) {
                    return <span key={"pad" + idx} className="pg-cal-cell pg-cal-cell--empty" aria-hidden="true" />;
                  }
                  const dayEvents = eventsByDate.get(date) ?? [];
                  const isToday = date === today;
                  const cls = [
                    "pg-cal-cell",
                    isToday ? "pg-cal-cell--today" : "",
                    dayEvents.length ? "pg-cal-cell--click" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <button
                      key={date}
                      type="button"
                      className={cls}
                      onClick={() => dayEvents[0] && openNode(dayEvents[0])}
                      title={dayEvents.map((e) => `${e.title} · ${e.org.split(" · ")[0]}`).join(" / ") || undefined}
                      aria-label={
                        dayEvents.length
                          ? `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8))} 日：${dayEvents.map((e) => e.title).join("、")}`
                          : undefined
                      }
                    >
                      <span className="pg-cal-day">{Number(date.slice(8))}</span>
                      {dayEvents.map((e, i) => (
                        <span key={e.kind + i} className={"pg-cal-dot pg-cal-dot--" + e.kind} aria-hidden="true" />
                      ))}
                    </button>
                  );
                })}
              </div>
              <div className="pg-cal-legend">
                <span className="pg-cal-legend-item">
                  <span className="pg-cal-legend-dot pg-cal-dot--scheduled" aria-hidden="true" />计划面试
                </span>
                <span className="pg-cal-legend-item">
                  <span className="pg-cal-legend-dot pg-cal-dot--applied" aria-hidden="true" />投递
                </span>
                <span className="pg-cal-legend-item">
                  <span className="pg-cal-legend-dot pg-cal-dot--interviewed" aria-hidden="true" />已完成面试
                </span>
              </div>
              {nextScheduled ? (
                <div className="pg-cal-urgent" role="note" aria-label="紧节点提醒">
                  <ClockCircleOutlined />
                  <span className="pg-cal-urgent-dday">D-{pad2(nextScheduled.dday)}</span>
                  <span className="pg-cal-urgent-text">
                    <b>{nextScheduled.org.split(" · ")[0]} · {nextScheduled.title.split(" · ")[0]}</b>
                    ——{nextScheduled.dday === 0 ? "今天" : cnNum(nextScheduled.dday) + " 天后"}面试，提前调试设备与网络。
                  </span>
                </div>
              ) : null}
            </aside>
          </div>

          {/* 底部 · 岗位进度横带 */}
          <section className="pg-cal-companies" aria-labelledby="pg-cal-companies-title">
            <div className="pg-cal-sec-head">
              <h2 className="pg-cal-sec-title" id="pg-cal-companies-title">
                <span className="pg-cal-sec-no">02</span>岗位进度
              </h2>
              <span className="pg-cal-sec-meta">{positions.length} 岗位 · 本月</span>
            </div>
            <div className="pg-cal-company-strip">
              {positions.slice(0, 12).map((p) => (
                <button key={p.id} type="button" className="pg-cal-company" onClick={() => navigate(`/positions/${p.id}`)}>
                  <span className="pg-cal-company-org">{p.company}</span>
                  <span className="pg-cal-company-role">{p.title}</span>
                  <MtStatusTag tone={POSITION_STATUS_TONE[p.status] ?? "neutral"}>
                    {POSITION_STATUS_LABELS[p.status] ?? p.status}
                  </MtStatusTag>
                </button>
              ))}
            </div>
          </section>

          {/* 待跟进区 */}
          {followUps.length > 0 ? (
            <section className="pg-cal-followup" aria-labelledby="pg-cal-followup-title">
              <div className="pg-cal-sec-head">
                <h2 className="pg-cal-sec-title" id="pg-cal-followup-title">
                  <span className="pg-cal-sec-no">03</span>待跟进
                </h2>
                <span className="pg-cal-sec-meta">{followUps.length} 项 · 投递超 7 天无进展</span>
              </div>
              <div className="pg-cal-followup-list">
                {followUps.map(({ position, days }) => (
                  <div key={position.id} className="pg-cal-followup-item">
                    <span className="pg-cal-followup-days">已等 {days} 天</span>
                    <span className="pg-cal-followup-label">{position.company} · {position.title}</span>
                    <span style={{ marginLeft: "auto" }}>
                      <button type="button" className="pg-cal-link" onClick={() => navigate(`/positions/${position.id}`)}>
                        查看 →
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
