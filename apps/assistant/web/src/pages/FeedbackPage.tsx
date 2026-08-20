import { useEffect, useState } from "react";
import { Button, Card, Table, Tag, message } from "antd";
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
            render: (v: string) => (v ? <Tag>{v}</Tag> : <Tag color="blue">助手对话</Tag>),
          },
          {
            title: "操作",
            width: 100,
            render: (_, row) => (
              <Button size="small" danger onClick={() => remove(row.id)}>
                删除
              </Button>
            ),
          },
        ]}
      />
    </Card>
  );
}
