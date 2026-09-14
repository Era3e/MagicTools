import { useEffect, useState } from "react";
import { Button, Card, Table, message } from "antd";
import { MtStatusTag } from "@mt/ui";
import { api, type Feedback } from "../api";

export default function FeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);

  const refresh = () => api.listFeedback().then(setItems).catch((err) => message.error(String(err)));

  useEffect(() => {
    refresh();
  }, []);

  const remove = async (id: string) => {
    try {
      await api.deleteFeedback(id);
      message.success("已删除");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  const createBadcase = async (id: string) => {
    try {
      await api.createFeedbackBadcase(id);
      message.success("已转为 badcase");
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card title="用户反馈">
      <Table<Feedback>
        rowKey="id"
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "内容", dataIndex: "content", ellipsis: true },
          {
            title: "时间",
            dataIndex: "createdAt",
            width: 180,
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: "来源",
            dataIndex: "contact",
            width: 120,
            render: (v: string) => (v ? <MtStatusTag tone="neutral" mono>{v}</MtStatusTag> : <MtStatusTag tone="info">助手对话</MtStatusTag>),
          },
          {
            title: "证据",
            width: 100,
            render: (_, row) => <MtStatusTag tone={row.traceId ? "success" : "neutral"}>{row.traceId ? "有 trace" : "无 trace"}</MtStatusTag>,
          },
          {
            title: "操作",
            width: 160,
            render: (_, row) => (
              <>
                <Button size="small" onClick={() => createBadcase(row.id)}>转 badcase</Button>
                <Button size="small" danger onClick={() => remove(row.id)}>删除</Button>
              </>
            ),
          },
        ]}
      />
    </Card>
  );
}
