import { Button, Card, Space, Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Item } from "../api";

export default function ItemList() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (sourceId) api.listItems(sourceId).then(setItems).catch((err) => console.error(err));
  }, [sourceId]);

  const push = async () => {
    if (selected.length === 0) {
      message.warning("先勾选条目");
      return;
    }
    try {
      const out = await api.pushItems(selected);
      message.success("已推送 " + out.pushedCount + " 条（待 Scholar 接收）");
      setSelected([]);
      if (sourceId) api.listItems(sourceId).then(setItems);
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card
      title="采集条目"
      extra={
        <Space>
          <Button onClick={() => navigate(-1)}>返回</Button>
          <Button type="primary" onClick={push}>推送选中（{selected.length}）</Button>
        </Space>
      }
    >
      <Table<Item>
        rowKey="id"
        dataSource={items}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]) }}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "标题", dataIndex: "title", ellipsis: true, render: (v: string, row) => (row.url ? <a href={row.url} target="_blank" rel="noreferrer">{v}</a> : v) },
          { title: "分类", dataIndex: "category", width: 120, render: (v: string) => (v ? <Tag>{v}</Tag> : "-") },
          { title: "关键词", dataIndex: "keywords", width: 220, render: (v: string[]) => (v ?? []).slice(0, 3).join("、") || "-" },
          { title: "富化", dataIndex: "llmEnriched", width: 80, render: (v: boolean) => (v ? <Tag color="blue">LLM</Tag> : <Tag>基础</Tag>) },
          { title: "已推送", dataIndex: "pushedAt", width: 100, render: (v: string | null) => (v ? <Tag color="green">已推送</Tag> : <Tag>未推送</Tag>) },
        ]}
        expandable={{
          expandedRowRender: (row) => (
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12 }}>
              {row.summary ? "摘要：" + row.summary + "\n\n" : ""}{row.content.slice(0, 1500)}
            </pre>
          ),
        }}
      />
    </Card>
  );
}
