import { Button, Card, Space, Table, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MtStatusTag } from "@mt/ui";
import { api, type Item } from "../api";

export default function ItemList() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!sourceId) return;
    setLoading(true);
    api.listItems(sourceId).then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, [sourceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const push = async () => {
    if (selected.length === 0) {
      message.warning("先勾选条目");
      return;
    }
    try {
      const out = await api.pushItems(selected);
      message.success(
        "已推送 " +
          out.pushedCount +
          " 条至 Scholar 收件箱（knowledge.item.collected 事件），请通知知识管理员在 Scholar 前台点击「收 Gatherer 事件」拉取。"
      );
      setSelected([]);
      refresh();
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
        loading={loading}
        rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]) }}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "标题", dataIndex: "title", ellipsis: true, render: (v: string, row) => (row.url ? <a href={row.url} target="_blank" rel="noreferrer">{v}</a> : v) },
          { title: "分类", dataIndex: "category", width: 120, render: (v: string) => (v ? <MtStatusTag tone="neutral" mono>{v}</MtStatusTag> : "-") },
          { title: "关键词", dataIndex: "keywords", width: 220, render: (v: string[]) => (v ?? []).slice(0, 3).join("、") || "-" },
          { title: "富化", dataIndex: "llmEnriched", width: 80, render: (v: boolean) => (v ? <MtStatusTag tone="info" mono>LLM</MtStatusTag> : <MtStatusTag tone="neutral">基础</MtStatusTag>) },
          { title: "已推送", dataIndex: "pushedAt", width: 100, render: (v: string | null) => (v ? <MtStatusTag tone="success" showDot>已推送</MtStatusTag> : <MtStatusTag tone="neutral">未推送</MtStatusTag>) },
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
