import { useState } from "react";
import { Button, Card, Input, List, Radio, Space, Tag } from "antd";
import { api, type SearchHit } from "../api";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"fts" | "vector">("fts");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      setHits(await api.search(q.trim(), mode));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="知识检索">
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="输入关键词" style={{ width: 280 }} value={q} onChange={(e) => setQ(e.target.value)} onPressEnter={run} />
        <Button type="primary" loading={loading} onClick={run}>
          搜索
        </Button>
        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value as "fts" | "vector")}
          options={[
            { value: "fts", label: "全文" },
            { value: "vector", label: "向量" },
          ]}
        />
      </Space>
      <List<SearchHit>
        dataSource={hits}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={
                <Space>
                  <span>{item.title}</span>
                  <Tag color="blue">相似度 {item.score.toFixed(2)}</Tag>
                  <Tag>{item.source}</Tag>
                  {item.category ? <Tag>{item.category}</Tag> : null}
                </Space>
              }
              description={item.content.slice(0, 200)}
            />
          </List.Item>
        )}
      />
    </Card>
  );
}
