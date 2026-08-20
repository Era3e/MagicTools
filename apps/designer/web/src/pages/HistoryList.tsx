import { useEffect, useState } from "react";
import { Button, Card, Table, Tag, message } from "antd";
import { api, downloadText, type Generation } from "../api";

export default function HistoryList() {
  const [items, setItems] = useState<Generation[]>([]);

  const refresh = () => api.listGenerations().then(setItems).catch((err) => message.error(String(err)));

  useEffect(() => {
    refresh();
  }, []);

  return (
    <Card title="生成历史">
      <Table<Generation>
        rowKey="id"
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "描述", dataIndex: "prompt", ellipsis: true },
          { title: "组件", dataIndex: "componentName", width: 180, render: (v: string) => v || "-" },
          {
            title: "状态",
            dataIndex: "status",
            width: 100,
            render: (v: string) => <Tag color={v === "ok" ? "green" : "red"}>{v === "ok" ? "成功" : "失败"}</Tag>,
          },
          {
            title: "时间",
            dataIndex: "createdAt",
            width: 180,
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: "操作",
            width: 120,
            render: (_, row) =>
              row.status === "ok" && row.code ? (
                <Button size="small" onClick={() => downloadText(row.componentName + ".tsx", row.code)}>下载</Button>
              ) : null,
          },
        ]}
      />
    </Card>
  );
}
