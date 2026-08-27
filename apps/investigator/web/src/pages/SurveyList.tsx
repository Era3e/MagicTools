import { Button, Card, Space, Table, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Survey } from "../api";
import { SurveyForm, type SurveyFormValues } from "../components/SurveyForm";

export default function SurveyList() {
  const [items, setItems] = useState<Survey[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Survey | null>(null);
  const [feishu, setFeishu] = useState<{ configured: boolean; stub?: boolean } | null>(null);

  const refresh = () => api.listSurveys().then(setItems);

  useEffect(() => {
    refresh();
    api.feishuStatus().then(setFeishu).catch(() => setFeishu(null));
  }, []);

  const buildInitial = (s: Survey): SurveyFormValues => ({
    name: s.name,
    description: s.description || undefined,
    appToken: s.appToken || undefined,
    tableId: s.tableId || undefined,
    answerFieldsText: (s.answerFields ?? []).join(","),
  });

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
          {
            title: "操作",
            width: 100,
            render: (_: unknown, row: Survey) => (
              <Button size="small" onClick={() => setEditing(row)}>
                编辑
              </Button>
            ),
          },
        ]}
      />
      <SurveyForm
        open={creating}
        onCancel={() => setCreating(false)}
        onSubmit={async (values) => {
          const answerFields = values.answerFieldsText
            ? values.answerFieldsText.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
          await api.createSurvey({ ...values, answerFields });
          message.success("已创建");
          setCreating(false);
          refresh();
        }}
      />
      <SurveyForm
        open={!!editing}
        title={"编辑调研主题 · " + (editing?.name ?? "")}
        initialValues={editing ? buildInitial(editing) : undefined}
        onCancel={() => setEditing(null)}
        onSubmit={async (values) => {
          if (!editing) return;
          const answerFields = values.answerFieldsText
            ? values.answerFieldsText.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
          await api.updateSurvey(editing.id, { ...values, answerFields });
          message.success("已更新");
          setEditing(null);
          refresh();
        }}
      />
    </Card>
  );
}
