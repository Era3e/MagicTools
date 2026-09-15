import { useEffect, useMemo, useState } from "react";
import { Card, Input, Skeleton, Space, Tag, Typography } from "antd";
import { MtEmptyState, MtKpiRow, MtStatusTag, useTheme } from "@mt/ui";
import { api, type PublicEntry } from "../api";

export default function HelpPage() {
  const theme = useTheme();
  const [entries, setEntries] = useState<PublicEntry[] | null>(null);
  const [version, setVersion] = useState<{ version: string; deploymentRef: string; sourceRevision: string } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.currentPublicVersion(), api.listPublicEntries()])
      .then(([currentVersion, items]) => {
        setVersion(currentVersion);
        setEntries(Array.isArray(items) ? items : []);
      })
      .catch((err) => setError(String(err)));
  }, []);

  const filtered = useMemo(() => {
    const list = entries ?? [];
    if (!keyword.trim()) return list;
    const words = keyword.trim().toLowerCase().split(/\s+/);
    return list.filter((entry) => {
      const text = [entry.title, entry.summary, entry.content, entry.category, ...entry.tags].join("\n").toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [entries, keyword]);

  if (error) return <MtEmptyState title="帮助版本暂不可用" description={error} />;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space wrap>
            <Typography.Title level={3} style={{ margin: 0, fontFamily: theme.displayFont }}>
              MagicTools 用户帮助
            </Typography.Title>
            <MtStatusTag tone="success" showDot>当前发布</MtStatusTag>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            只展示当前产品版本中的任务说明。每个任务按目标与入口、结果校验、异常口径组织，不暴露内部部署细节。
          </Typography.Paragraph>
          <Input.Search
            allowClear
            size="large"
            placeholder="搜索任务，例如：简历、需求、引用"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          {version ? (
            <Space wrap size={8}>
              <Tag color="green" style={versionTagStyle}>版本 {version.version}</Tag>
              <Tag style={versionTagStyle}>来源 {version.sourceRevision}</Tag>
              <Tag style={versionTagStyle}>部署 {version.deploymentRef}</Tag>
            </Space>
          ) : null}
        </Space>
      </Card>

      <MtKpiRow
        items={[
          { label: "已发布任务", value: entries?.length ?? 0, unit: "条" },
          { label: "当前筛选", value: filtered.length, unit: "条" },
          { label: "需求证据", value: (entries ?? []).filter((entry) => entry.requirementLinks.length > 0).length, unit: "条" },
        ]}
      />

      {entries === null ? (
        <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
      ) : filtered.length === 0 ? (
        <MtEmptyState title="没有匹配的帮助任务" description="换个关键词，或在帮助检索中使用自然语言查询" />
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }} data-testid="help-entry-rows">
          {filtered.map((entry) => (
            <Card key={entry.id} title={entry.title} extra={<Tag color="green">{entry.category}</Tag>}>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Typography.Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{entry.content}</Typography.Paragraph>
                <Space wrap size={6}>
                  {entry.tags.map((tag) => <Tag key={tag}>#{tag}</Tag>)}
                  {entry.sourceUrl ? <a href={entry.sourceUrl} target="_blank" rel="noreferrer">来源证据</a> : null}
                  {entry.requirementLinks.map((link) => (
                    <a key={entry.id + ":" + link.requirementId} href={link.requirementUrl || undefined} target="_blank" rel="noreferrer">
                      需求 {link.requirementId}
                    </a>
                  ))}
                </Space>
              </Space>
            </Card>
          ))}
        </Space>
      )}
    </Space>
  );
}

const versionTagStyle = {
  maxWidth: "100%",
  whiteSpace: "break-spaces",
  wordBreak: "break-all",
  marginInlineEnd: 0,
} as const;
