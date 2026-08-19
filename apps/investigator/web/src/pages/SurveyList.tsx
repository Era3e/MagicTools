import { Button, Card, Space, Table, Tag } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Survey } from "../api";
import { SurveyForm } from "../components/SurveyForm";

export default function SurveyList() {
  const [items, setItems] = useState<Survey[]>([]);
  const [creating, setCreating] = useState(false);
  const [feishu, setFeishu] = useState<{ configured: boolean; stub?: boolean } | null>(null);

  const refresh = () => api.listSurveys().then(setItems);

  useEffect(() => {
    refresh();
    api.feishuStatus().then(setFeishu).catch(() => setFeishu(null));
  }, []);

  return (
    <Card
      title="调研主题"
      extra={
        <Space>
          <Tag color={feishu?.configured ? "green" : "orange"}>
            {feishu?.configured ? (feishu.stub ? "飞书桩模式" : "飞书已配置") : "飞书未配置"}
          </Tag>
          <Button type="primary" onClick={() => setCreating(true)}>
            新建主题
          </Button>
        </Space>
      }
    >
      <Table<Survey>
        rowKey="id"
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "名称", dataIndex: "name", render: (v: string, row) => <Link to={"/surveys/" + row.id}>{v}</Link> },
          { title: "描述", dataIndex: "description", ellipsis: true },
          { title: "状态", dataIndex: "status", width: 90, render: (v: string) => <Tag color={v === "active" ? "green" : "default"}>{v}</Tag> },
          { title: "最近同步", dataIndex: "lastSyncedAt", width: 180, render: (v: string | null) => (v ? new Date(v).toLocaleString() : "-") },
        ]}
      />
      <SurveyForm
        open={creating}
        onCancel={() => setCreating(false)}
        onSubmit={async (values) => {
          await api.createSurvey(values);
          setCreating(false);
          refresh();
        }}
      />
    </Card>
  );
}
