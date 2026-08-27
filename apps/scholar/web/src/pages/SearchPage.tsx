import { useState } from "react";
import { Button, Empty, Input, Radio, Skeleton, Tag } from "antd";
import { tokens, useTheme } from "@mt/ui";
import { api, type SearchHit } from "../api";

const SOURCE_LABEL: Record<string, string> = { gatherer: "采集入藏", manual: "手稿", obsidian: "黑曜石笔记" };

export default function SearchPage() {
  const theme = useTheme();
  const CATALOG = {
    ink: theme.ink,
    green: theme.primary,
    paper: theme.paper ?? theme.background,
    muted: theme.muted,
    rule: theme.rule ?? tokens.color.border,
    display: theme.displayFont,
    body: theme.bodyFont,
  };
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"fts" | "vector">("fts");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      setHits(await api.search(q.trim(), mode));
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: CATALOG.body, color: CATALOG.ink }}>
      <div style={{ textAlign: "center", marginBottom: 8, letterSpacing: 8, color: CATALOG.green, fontSize: 12 }}>
        CATALOGUE · 书 目 检 索
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          borderBottom: "2px solid " + CATALOG.ink,
          paddingBottom: 12,
        }}
      >
        <Input
          placeholder="输入关键词"
          size="large"
          variant="borderless"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={run}
          style={{ fontFamily: CATALOG.display, fontSize: 18 }}
        />
        <Button
          type="text"
          loading={loading}
          onClick={run}
          style={{
            fontFamily: CATALOG.display,
            letterSpacing: 4,
            color: CATALOG.green,
            border: "1px solid " + CATALOG.green,
            borderRadius: 0,
            paddingInline: 18,
          }}
        >
          检 索
        </Button>
      </div>

      <Radio.Group
        value={mode}
        onChange={(e) => setMode(e.target.value as "fts" | "vector")}
        style={{ margin: "10px 0 4px", fontFamily: CATALOG.body }}
        optionType="button"
        buttonStyle="solid"
        options={[
          { value: "fts", label: "全文检索" },
          { value: "vector", label: "语义向量" },
        ]}
      />

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : hits.length === 0 ? (
          searched ? (
            <Empty description={<span style={{ color: CATALOG.muted }}>馆内未检出此条目——换个说法试试</span>} />
          ) : (
            <p style={{ textAlign: "center", color: CATALOG.muted, fontStyle: "italic", marginTop: 48 }}>
              输入关键词，在馆藏中寻书
            </p>
          )
        ) : (
          <>
            <div style={{ color: CATALOG.muted, fontSize: 12, marginBottom: 10 }}>
              检得 <b style={{ color: CATALOG.green }}>{hits.length}</b> 条馆藏 · 按相关度陈列
            </div>
            {hits.map((h, i) => (
              <article
                key={h.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr",
                  gap: 16,
                  padding: "18px 4px",
                  borderTop: i === 0 ? "1px solid " + CATALOG.rule : undefined,
                  borderBottom: "1px solid " + CATALOG.rule,
                }}
              >
                <div
                  style={{
                    fontFamily: CATALOG.display,
                    fontSize: 26,
                    color: CATALOG.green,
                    textAlign: "center",
                    lineHeight: "48px",
                    borderRight: "2px solid " + CATALOG.paper,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <h3 style={{ fontFamily: CATALOG.display, fontSize: 18, margin: "0 0 6px", color: CATALOG.ink }}>
                    {h.title}
                  </h3>
                  <div style={{ marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}>
                    <Tag style={{ borderRadius: 0, fontFamily: CATALOG.body }} color="green">
                      {SOURCE_LABEL[h.source] ?? h.source}
                    </Tag>
                    {h.category ? (
                      <span style={{ color: CATALOG.muted, fontSize: 12 }}>〔{h.category}〕</span>
                    ) : null}
                    <span style={{ color: CATALOG.muted, fontSize: 12 }}>· 相似度 {h.score.toFixed(2)}</span>
                  </div>
                  <p style={{ margin: 0, color: CATALOG.muted, lineHeight: 1.9, textAlign: "justify" }}>
                    {h.content.slice(0, 220) || h.summary || "（此条目暂无摘录）"}
                  </p>
                </div>
              </article>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
