import { Input, Pagination, Skeleton, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Position } from "../api";
import { MtEmptyState, MtStatusTag, tokens, useTheme } from "@mt/ui";
import { POSITION_STATUS_LABELS } from "../status";

const PAGE_SIZE = 9;

const CITY_PILLS = ["全部", "北京", "上海", "深圳", "杭州", "远程"];
const KIND_PILLS = ["全部", "全职", "实习", "兼职"];

export default function PositionWall() {
  const [items, setItems] = useState<Position[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [city, setCity] = useState("全部");
  const [kind, setKind] = useState("全部");
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const WALL = {
    ink: theme.ink,
    accent: theme.accent ?? theme.primary,
    tint: theme.tint ?? theme.paper ?? theme.background,
    muted: theme.muted,
    panel: theme.panel ?? theme.card ?? "#ffffff",
    border: theme.border ?? theme.rule,
    display: theme.displayFont,
    sans: theme.bodyFont,
  };

  const refresh = useCallback(() => {
    setLoading(true);
    api
      .listPositions()
      .then((all) => {
        let filtered = all;
        if (q) {
          const kw = q.toLowerCase();
          filtered = filtered.filter(
            (p) =>
              p.company.toLowerCase().includes(kw) ||
              p.title.toLowerCase().includes(kw) ||
              (p.city ?? "").toLowerCase().includes(kw)
          );
        }
        if (city !== "全部") filtered = filtered.filter((p) => (p.city ?? "").includes(city));
        if (kind !== "全部") filtered = filtered.filter((p) => (p.title ?? "").includes(kind));
        setTotal(filtered.length);
        setItems(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
      })
      .catch((err) => message.error(String(err)))
      .finally(() => setLoading(false));
  }, [q, page, city, kind]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCount = useMemo(() => items.filter((p) => !["rejected", "offer"].includes(p.status)).length, [items]);

  return (
    <div className="pg-wall" style={{ fontFamily: WALL.sans, color: WALL.ink, display: "flex", flexDirection: "column", gap: tokens.spacing.lg }}>
      <style>{`
@media (max-width: 860px) {
  .pg-wall .pg-wall-hero { grid-template-columns: minmax(0, 1fr) !important; }
  .pg-wall .pg-wall-stats { border-left: none !important; border-top: 1px solid ${WALL.border}; padding-left: 0 !important; padding-top: 16px; flex-direction: row; gap: 32px; }
}
@media (max-width: 720px) {
  .pg-wall .pg-wall-grid { grid-template-columns: minmax(0, 1fr) !important; }
  .pg-wall .pg-wall-head { grid-column: auto !important; }
}
`}</style>
      {/* Hero：编辑部特稿式 */}
      <section
        className="pg-wall-hero"
        style={{
          background: WALL.tint,
          borderRadius: tokens.radiusTokens.lg,
          padding: tokens.spacing.xl + "px " + tokens.spacing.lg,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(200px, 1fr)",
          gap: tokens.spacing.lg,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontFamily: tokens.font.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: WALL.accent, fontWeight: 600, marginBottom: 8 }}>
            JOB WALL · 岗位博览
          </div>
          <h1 style={{ margin: "0 0 10px", fontFamily: WALL.display, fontSize: 36, fontWeight: 600, lineHeight: 1.2 }}>
            下一段职业生涯，
            <em style={{ fontStyle: "normal", color: WALL.accent }}>从一面岗位墙开始</em>
          </h1>
          <p style={{ margin: 0, color: WALL.muted, fontSize: 15, lineHeight: 1.75, maxWidth: 560 }}>
            每一次投递，都值得被认真对待。机会按周更新，简历工坊随时待命。
          </p>
        </div>
        <div className="pg-wall-stats" style={{ borderLeft: "1px solid " + WALL.border, paddingLeft: tokens.spacing.lg, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontFamily: tokens.font.mono, fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: WALL.accent }}>{total}</div>
            <div style={{ fontSize: 12, color: WALL.muted }}>在招机会</div>
          </div>
          <div>
            <div style={{ fontFamily: tokens.font.mono, fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>+{openCount || 0}</div>
            <div style={{ fontSize: 12, color: WALL.muted }}>本页新增</div>
          </div>
        </div>
      </section>

      {/* 筛选行：胶囊单选组 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.spacing.md, alignItems: "center" }}>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: WALL.muted }}>城市</span>
        {CITY_PILLS.map((c) => (
          <Pill key={c} active={city === c} onClick={() => { setCity(c); setPage(1); }}>{c}</Pill>
        ))}
        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: WALL.muted, marginLeft: 12 }}>职类</span>
        {KIND_PILLS.map((k) => (
          <Pill key={k} active={kind === k} onClick={() => { setKind(k); setPage(1); }}>{k}</Pill>
        ))}
        <span style={{ marginLeft: "auto" }}>
          <Input.Search
            placeholder="检索公司 / 职位 / 城市"
            style={{ width: 240 }}
            allowClear
            onSearch={(v) => {
              setQ(v);
              setPage(1);
            }}
          />
        </span>
      </div>

      {/* 岗位墙：2 列网格，头条跨双列 */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: tokens.spacing.md }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton.Node key={i} active style={{ width: "100%", height: 160 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <MtEmptyState title="尚无岗位在册" description="去后台录入第一条机会吧。" />
      ) : (
        <div className="pg-wall-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: tokens.spacing.md }}>
          {items.map((p, index) => {
            const head = index === 0;
            return (
              <Link
                key={p.id}
                to={"/positions/" + p.id}
                className={head ? "pg-wall-head" : undefined}
                style={{
                  gridColumn: head ? "1 / -1" : undefined,
                  display: "block",
                  background: WALL.panel,
                  border: "1px solid " + WALL.border,
                  borderTop: head ? "4px solid " + WALL.accent : undefined,
                  padding: head ? 24 : 20,
                  color: "inherit",
                  textDecoration: "none",
                  borderRadius: tokens.radiusTokens.md,
                  boxShadow: tokens.shadow.card,
                  transition: "border-color " + tokens.motion.durationFast + " " + tokens.motion.easeStandard + ", transform " + tokens.motion.durationFast + " " + tokens.motion.easeStandard,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: WALL.muted }}>
                    No. {String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                  </span>
                  {head ? (
                    <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 10px", borderRadius: 999, border: "1px solid " + WALL.accent, color: WALL.accent, fontFamily: tokens.font.mono, fontSize: 11 }}>
                      头条岗位
                    </span>
                  ) : null}
                  <MtStatusTag tone={p.status === "offer" ? "success" : p.status === "rejected" ? "neutral" : "info"}>
                    {POSITION_STATUS_LABELS[p.status] ?? p.status}
                  </MtStatusTag>
                </div>
                <h3 style={{ fontFamily: WALL.display, fontSize: head ? 22 : 17, fontWeight: 600, margin: "0 0 4px", color: WALL.ink }}>
                  {p.title}
                </h3>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                  <span style={{ color: WALL.accent, fontSize: 13, fontWeight: 600 }}>{p.company}</span>
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: WALL.muted }}>{p.city || "—"}</span>
                </div>
                <div style={{ color: WALL.muted, fontSize: 12, marginTop: 8, fontFamily: tokens.font.mono }}>
                  更新于 {new Date(p.updatedAt).toLocaleDateString()}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: "center" }}>
        <Pagination current={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} showSizeChanger={false} />
      </div>
    </div>
  );
}

function Pill(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  const accent = theme.accent ?? theme.primary;
  const tint = theme.tint ?? theme.paper ?? theme.background;
  return (
    <button
      type="button"
      aria-pressed={props.active}
      onClick={props.onClick}
      style={{
        height: 26,
        padding: "0 14px",
        borderRadius: 999,
        border: "1px solid " + (props.active ? accent : theme.border ?? theme.rule),
        background: props.active ? tint : "transparent",
        color: props.active ? accent : theme.muted,
        fontSize: 12,
        fontWeight: props.active ? 600 : 400,
        cursor: "pointer",
        fontFamily: theme.bodyFont,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}
