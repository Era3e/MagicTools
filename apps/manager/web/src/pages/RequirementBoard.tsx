import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Empty, Skeleton, Tag, message } from "antd";
import { tokens, useTheme } from "@mt/ui";
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

/** 优先级颜色：P0/P1 走平台 tokens 语义色，P2 走应用主题 muted */
function priorityColor(priority: string, muted: string): string {
  if (priority === "P0") return tokens.color.error;
  if (priority === "P1") return tokens.color.warning;
  return muted;
}

export default function RequirementBoard() {
  const theme = useTheme();
  const DECK = {
    ink: theme.ink,
    sky: theme.primary,
    bg: theme.bg ?? theme.background,
    panel: theme.panel ?? theme.background,
    border: theme.border ?? tokens.color.border,
    muted: theme.muted,
    mono: theme.displayFont,
    sans: theme.bodyFont,
  };
  const [items, setItems] = useState<Requirement[] | null>(null);

  const refresh = useCallback(() => {
    api.listRequirements().then(setItems).catch((err) => message.error(String(err)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div style={{ fontFamily: DECK.sans, color: DECK.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontFamily: DECK.mono, letterSpacing: 3, color: DECK.sky, fontSize: 12 }}>
          FLIGHT DECK · 需求在轨
        </span>
        <span data-testid="board-total" style={{ fontFamily: DECK.mono, fontSize: 12, color: DECK.muted }}>
          TOTAL {items?.length ?? "--"}
        </span>
      </div>
      <div style={{ height: 2, background: DECK.ink, marginBottom: 16 }} />

      {items === null ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <div
          data-testid="board-lanes"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(150px, 1fr))",
            gap: 10,
            overflowX: "auto",
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
                    borderBottom: "2px solid " + (cards.length > 0 ? DECK.sky : DECK.border),
                    paddingBottom: 6,
                    marginBottom: 8,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{lane.label}</span>
                  <span>{String(cards.length).padStart(2, "0")}</span>
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
                        background: DECK.panel,
                        border: "1px solid " + DECK.border,
                        borderLeft: "3px solid " + priorityColor(r.priority, DECK.muted),
                        padding: "8px 10px",
                        marginBottom: 8,
                        color: DECK.ink,
                      }}
                    >
                      <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {r.title}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: DECK.mono, fontSize: 10, color: priorityColor(r.priority, DECK.muted) }}>
                          {r.priority}
                        </span>
                        {r.prUrl ? <Tag color="blue" style={{ fontSize: 10, margin: 0, paddingInline: 4 }}>PR</Tag> : null}
                      </div>
                    </Link>
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}

      {items !== null && items.length === 0 ? (
        <Empty description={<span style={{ color: DECK.muted }}>暂无在轨需求——去后台拉取收件箱</span>} style={{ marginTop: 48 }} />
      ) : null}
    </div>
  );
}
