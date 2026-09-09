import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton, message } from "antd";
import { MtStatusTag, MtEmptyState, tokens, useTheme } from "@mt/ui";
import { api, type Requirement } from "../api";

const LANES: Array<{ key: string; label: string; code: string }> = [
  { key: "waiting", label: "待分析", code: "WAIT" },
  { key: "designing", label: "设计中", code: "DSGN" },
  { key: "todo", label: "待开发", code: "TODO" },
  { key: "developing", label: "开发中", code: "DEV" },
  { key: "testing", label: "测试中", code: "TEST" },
  { key: "accepting", label: "待验收", code: "ACPT" },
  { key: "done", label: "已完成", code: "DONE" },
];

const PRIORITY_TONE = { P0: "error", P1: "warning", P2: "info" } as const;

export default function RequirementBoard() {
  const theme = useTheme();
  const DECK = {
    ink: theme.ink,
    sky: theme.primary,
    accent: theme.accent ?? theme.primary,
    tint: theme.tint ?? theme.paper ?? theme.background,
    bg: theme.background,
    panel: theme.panel ?? "#ffffff",
    board: theme.board ?? theme.panel ?? "#fbfcfd",
    border: theme.border ?? tokens.color.border,
    muted: theme.muted,
    display: theme.displayFont,
    mono: tokens.font.mono,
    sans: theme.bodyFont,
  };
  const [items, setItems] = useState<Requirement[] | null>(null);
  const [iterations, setIterations] = useState<Array<{ id: string; name: string }>>([]);
  const [activeIter, setActiveIter] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.listRequirements().then(setItems).catch((err) => message.error(String(err)));
    api.listIterations().then(setIterations).catch(() => setIterations([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const kpis = useMemo(() => {
    const list = items ?? [];
    const done = list.filter((r) => r.status === "done").length;
    const active = list.filter((r) => !["done", "waiting"].includes(r.status)).length;
    const blocked = list.filter((r) => r.status === "testing" || r.status === "accepting").length;
    return [
      { label: "活跃需求", value: active, unit: "条" },
      { label: "已交付", value: done, unit: "条" },
      { label: "阻塞", value: blocked, unit: "条" },
      { label: "完成率", value: list.length ? Math.round((done / list.length) * 100) + "%" : "—", unit: "" },
    ];
  }, [items]);

  return (
    <div className="pg-flight" style={{ fontFamily: DECK.sans, color: DECK.ink, display: "flex", flexDirection: "column", gap: tokens.spacing.lg, minWidth: 0 }}>
      <style>{`
@media (max-width: 960px) {
  .pg-flight .rb-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .pg-flight .rb-lanes-wrap { min-width: 0; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
}
@media (max-width: 640px) {
  .pg-flight .rb-kpis { grid-template-columns: minmax(0, 1fr) !important; }
  .pg-flight .rb-hero-title { font-size: 24px !important; }
  .pg-flight .rb-sec-head { flex-direction: column; gap: 8px; align-items: flex-start; }
}
`}</style>
      {/* Hero：FLIGHT DECK */}
      <section style={{ paddingBottom: tokens.spacing.md, borderBottom: "1px solid " + DECK.border }}>
        <div style={{ fontFamily: DECK.mono, letterSpacing: "0.08em", color: DECK.accent, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
          FLIGHT DECK · 需求在轨
        </div>
        <h1 className="rb-hero-title" style={{ margin: "8px 0 6px", fontFamily: DECK.display, fontSize: 28, fontWeight: 600, lineHeight: 1.25 }}>
          交付驾驶舱
        </h1>
        <p style={{ margin: 0, color: DECK.muted, fontSize: 15, lineHeight: 1.75, maxWidth: 640 }}>
          需求在轨，交付有期。七态生命周期在此同屏巡航。
        </p>
        <div data-testid="board-total" style={{ display: "flex", flexWrap: "wrap", gap: "12px 0", marginTop: 10, alignItems: "baseline" }}>
          {kpis.map((k, i) => (
            <span
              key={k.label}
              style={{
                fontFamily: DECK.mono,
                fontSize: 12,
                color: DECK.muted,
                paddingLeft: i === 0 ? 0 : 16,
                marginLeft: i === 0 ? 0 : 16,
                borderLeft: i === 0 ? undefined : "1px solid " + DECK.border,
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {k.label} <b style={{ fontSize: 14, fontWeight: 600, color: DECK.accent }}>{k.value}</b>
              {k.unit ? <span style={{ marginLeft: 2 }}>{k.unit}</span> : null}
            </span>
          ))}
          <span style={{ marginLeft: "auto", fontFamily: DECK.mono, fontSize: 12, color: DECK.muted }}>
            TOTAL {items?.length ?? "--"}
          </span>
        </div>
      </section>

      {/* 01 关键读数：4 卡 accent 顶边 */}
      <section aria-labelledby="rb-kpi-title">
        <SecHead no="01" title="关键读数" meta="4 × 1 · 实时" />
        <div className="rb-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: tokens.spacing.md }}>
          {kpis.map((k) => (
            <div
              key={k.label}
              style={{
                background: DECK.panel,
                borderTop: "4px solid " + DECK.accent,
                border: "1px solid " + DECK.border,
                borderTopWidth: 4,
                borderTopColor: DECK.accent,
                borderRadius: tokens.radiusTokens.md,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 12, color: DECK.muted }}>{k.label}</span>
              <span style={{ fontFamily: DECK.mono, fontSize: 24, fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                {k.value}
                {k.unit ? <span style={{ fontSize: 12, fontWeight: 400, color: DECK.muted, marginLeft: 2 }}>{k.unit}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 02 泳道看板 */}
      <section aria-labelledby="rb-lane-title">
        <SecHead no="02" title="泳道看板" meta="7 泳道 · 生命周期" />
        {items === null ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <div className="rb-lanes-wrap">
          <div
            data-testid="board-lanes"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(150px, 1fr))",
              gap: 10,
              alignItems: "start",
            }}
          >
            {LANES.map((lane) => {
              const cards = items.filter((r) => r.status === lane.key);
              return (
                <section key={lane.key} style={{ minWidth: 150 }}>
                  <header
                    style={{
                      fontFamily: DECK.mono,
                      fontSize: 11,
                      color: DECK.muted,
                      background: DECK.board,
                      borderBottom: "2px solid " + (cards.length > 0 ? DECK.accent : DECK.border),
                      padding: "6px 8px",
                      marginBottom: 8,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{lane.label}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{String(cards.length).padStart(2, "0")}</span>
                  </header>
                  {cards.length === 0 ? (
                    <div style={{ color: DECK.border, fontSize: 11, textAlign: "center", padding: "12px 0", border: "1px dashed " + DECK.border }}>
                      {lane.code}
                    </div>
                  ) : (
                    cards.map((r) => (
                      <Link
                        key={r.id}
                        to={"/requirements/" + r.id}
                        style={{
                          display: "block",
                          background: DECK.board,
                          border: "1px solid " + DECK.border,
                          padding: "8px 10px",
                          marginBottom: 8,
                          color: DECK.ink,
                          borderRadius: tokens.radiusTokens.sm,
                        }}
                      >
                        <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {r.title}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <MtStatusTag tone={PRIORITY_TONE[r.priority as keyof typeof PRIORITY_TONE] ?? "neutral"} mono>
                            {r.priority}
                          </MtStatusTag>
                          {r.prUrl ? <MtStatusTag tone="info" mono>PR</MtStatusTag> : null}
                        </div>
                      </Link>
                    ))
                  )}
                </section>
              );
            })}
          </div>
          </div>
        )}
      </section>

      {/* 03 迭代切换 */}
      {iterations.length > 0 ? (
        <section aria-labelledby="rb-iter-title">
          <SecHead no="03" title="迭代切换" meta={`${iterations.length} 个迭代`} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {iterations.slice(0, 6).map((it) => {
              const active = activeIter === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveIter(active ? null : it.id)}
                  style={{
                    fontFamily: DECK.mono,
                    fontSize: 12,
                    padding: "6px 12px",
                    background: active ? DECK.tint : DECK.panel,
                    border: "1px solid " + (active ? DECK.accent : DECK.border),
                    borderRadius: tokens.radiusTokens.sm,
                    color: active ? DECK.accent : DECK.muted,
                    cursor: "pointer",
                  }}
                >
                  {it.name}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {items !== null && items.length === 0 ? (
        <div style={{ marginTop: 24 }}>
          <MtEmptyState title="暂无在轨需求" description="去后台拉取收件箱" />
        </div>
      ) : null}
    </div>
  );
}

function SecHead(props: { no: string; title: string; meta?: string }) {
  const theme = useTheme();
  const accent = theme.accent ?? theme.primary;
  const muted = theme.muted;
  return (
    <div className="rb-sec-head" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: tokens.spacing.md, marginBottom: tokens.spacing.md }}>
      <h2 style={{ margin: 0, fontFamily: theme.displayFont, fontSize: 22, fontWeight: 600, display: "inline-flex", gap: tokens.spacing.sm, alignItems: "baseline" }}>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: tokens.scale.amber[6] }}>{props.no}</span>
        {props.title}
      </h2>
      {props.meta ? (
        <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: muted, fontVariantNumeric: "tabular-nums" }}>{props.meta}</span>
      ) : null}
      <span aria-hidden style={{ display: "none", color: accent }} />
    </div>
  );
}
