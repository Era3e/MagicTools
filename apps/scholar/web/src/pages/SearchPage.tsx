import { useState } from "react";
import { Button, Input, Skeleton, Space, Tag } from "antd";
import { MtStatusTag, MtEmptyState, tokens, useTheme } from "@mt/ui";
import { api, type PublicSearchCandidate } from "../api";

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
  const [hits, setHits] = useState<PublicSearchCandidate[]>([]);
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const result = await api.publicSearch(q.trim());
      setHits(result.candidates);
      setVersion(result.candidates[0]?.productVersion ?? "");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: CATALOG.body, color: CATALOG.ink }}>
      <div style={{ textAlign: "center", marginBottom: 8, letterSpacing: 8, color: CATALOG.green, fontSize: 12 }}>
        HELP · 用 户 帮 助 检 索
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
          placeholder="输入任务或问题，例如：如何核对引用"
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

      <div style={{ margin: "10px 0 4px", color: CATALOG.muted, fontSize: 12 }}>
        服务端执行全文与语义混合检索；结果只来自当前发布版本 {version ? `· ${version}` : ""}
      </div>

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : hits.length === 0 ? (
          searched ? (
            <MtEmptyState title="当前帮助版本未检出" description="换个任务描述试试；未命中时 Assistant 也会明确说明未找到" />
          ) : (
            <p style={{ textAlign: "center", color: CATALOG.muted, fontStyle: "italic", marginTop: 48 }}>
              输入任务或问题，在当前发布帮助中查找证据
            </p>
          )
        ) : (
          <>
            <div style={{ color: CATALOG.muted, fontSize: 12, marginBottom: 10 }}>
              检得 <b style={{ color: CATALOG.green }}>{hits.length}</b> 条帮助证据 · 按相关度陈列
            </div>
            {hits.map((h, i) => (
              <article
                key={h.entryId}
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
                    <a href={h.sourceUrl || undefined} target="_blank" rel="noreferrer">{h.title}</a>
                  </h3>
                  <div style={{ marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}>
                    <MtStatusTag tone="success" mono>
                      {SOURCE_LABEL[h.source] ?? h.source}
                    </MtStatusTag>
                    {h.category ? (
                      <span style={{ color: CATALOG.muted, fontSize: 12 }}>〔{h.category}〕</span>
                    ) : null}
                    <span style={{ color: CATALOG.muted, fontSize: 12 }}>· 相关度 {h.score.toFixed(2)}</span>
                    <Tag style={{ borderRadius: 0 }}>{h.channels.join("+")}</Tag>
                    <Tag style={{ borderRadius: 0 }}>chunk {h.chunkNo} · {h.charStart}-{h.charEnd}</Tag>
                  </div>
                  <p style={{ margin: 0, color: CATALOG.muted, lineHeight: 1.9, textAlign: "justify" }}>
                    {h.content.slice(0, 360) || "（此证据暂无摘录）"}
                  </p>
                  <Space wrap size={6}>
                    {h.requirementLinks.map((link) => (
                      <a key={link.requirementId} href={link.requirementUrl || undefined} target="_blank" rel="noreferrer">
                        需求 {link.requirementId}
                      </a>
                    ))}
                  </Space>
                  <p style={{ margin: "8px 0 0", color: CATALOG.muted, fontSize: 12 }}>
                    版本 {h.productVersion} · 修订 {h.sourceRevision}
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
