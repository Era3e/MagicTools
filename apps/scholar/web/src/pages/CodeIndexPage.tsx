import { useEffect, useMemo, useState } from "react";
import { Button, Input, Space, Table, Tag, Typography } from "antd";
import { AdminPageHead, AdminToolbar, AdminToolbarCount, MtKpiRow, MtStatusTag } from "@mt/ui";
import { api, type Entry, type SearchHit } from "../api";

export default function CodeIndexPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    api.listEntries({ spaceKey: "development" }).then(setEntries).catch(() => setEntries([]));
  };

  useEffect(refresh, []);

  const run = async () => {
    if (!query.trim()) {
      setHits(null);
      return;
    }
    setLoading(true);
    try {
      setHits(await api.search(query.trim(), "fts", 20, "development"));
    } finally {
      setLoading(false);
    }
  };

  const keyword = query.trim().toLowerCase();
  const visible = useMemo(() => {
    const rows: Array<Entry | SearchHit> = hits ?? entries ?? [];
    if (hits || !keyword) return rows;
    return rows.filter((row) => [row.title, row.summary, row.content, row.category].join("\n").toLowerCase().includes(keyword));
  }, [entries, hits, keyword]);

  return (
    <div>
      <AdminPageHead
        eyebrow="ADMIN · CODE INDEX"
        title="项目代码检索"
        badges={<MtStatusTag tone="info" mono>development</MtStatusTag>}
        description="20 个高频开发问题与代码入口，绑定来源修订、验证口径和需求证据"
        kpi={
          <MtKpiRow
            items={[
              { label: "开发问题", value: entries?.length ?? 0, unit: "条" },
              { label: "当前结果", value: visible.length, unit: "条" },
              { label: "检索模式", value: hits ? "FTS" : "目录", unit: "" },
            ]}
          />
        }
      />
      <AdminToolbar>
        <Input.Search
          allowClear
          placeholder="检索系统边界、代码入口、验收口径…"
          style={{ width: 420 }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onSearch={run}
          enterButton={(
            <Button type="primary" loading={loading} onClick={run}>
              检索
            </Button>
          )}
        />
        <AdminToolbarCount>共 {visible.length} 条 · development 空间</AdminToolbarCount>
      </AdminToolbar>
        <Table<Entry | SearchHit>
        rowKey="id"
        dataSource={visible}
        loading={entries === null || loading}
        pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
        columns={[
          { title: "问题", dataIndex: "title", render: (value: string) => <Typography.Text strong>{value}</Typography.Text> },
          { title: "项目", dataIndex: "category", width: 110, render: (value: string) => <Tag>{value}</Tag> },
          {
            title: "代码入口与验收",
            dataIndex: "content",
            render: (value: string) => (
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap", maxHeight: 180, overflow: "hidden" }}>
                {value}
              </Typography.Paragraph>
            ),
          },
          {
            title: "证据",
            width: 150,
            render: (_: unknown, row: Entry | SearchHit) => (
              <Space direction="vertical" size={4}>
                <Typography.Text code>{row.sourceRevision}</Typography.Text>
                {row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noreferrer">来源证据</a> : null}
                {(row.requirementId ?? row.requirementLinks?.[0]?.requirementId) ? (
                  <a href={row.requirementUrl || row.requirementLinks?.[0]?.requirementUrl || undefined} target="_blank" rel="noreferrer">
                    需求 {row.requirementId ?? row.requirementLinks?.[0]?.requirementId}
                  </a>
                ) : null}
                <span>{row.content.includes("历史原因：未知") ? "历史原因：未知" : "按来源证据追溯"}</span>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
