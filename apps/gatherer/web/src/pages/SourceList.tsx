import { Button, Card, Form, Input, Modal, Select, Table, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MtStatusTag, tokens, type MtStatusTagTone } from "@mt/ui";
import { api, type Source } from "../api";

const TYPE_MAP: Record<string, { label: string; tone: MtStatusTagTone }> = {
  rss: { label: "RSS", tone: "success" },
  json_api: { label: "JSON API", tone: "info" },
  web: { label: "网页", tone: "accent" },
};

export default function SourceList() {
  const [items, setItems] = useState<Source[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Source | null>(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<{ name: string; type: string; url: string; cron?: string }>();

  const refresh = useCallback(() => {
    setLoading(true);
    api.listSources().then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Card
      title="信息源"
      extra={
        <Button type="primary" onClick={() => setCreating(true)}>
          新建源
        </Button>
      }
    >
      <Table<Source>
        data-testid="source-table"
        rowKey="id"
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "名称", dataIndex: "name", render: (v: string, row) => <Link to={"/sources/" + row.id}>{v}</Link> },
          { title: "类型", dataIndex: "type", width: 110, render: (v: string) => <MtStatusTag tone={TYPE_MAP[v]?.tone ?? "neutral"} mono>{TYPE_MAP[v]?.label ?? v}</MtStatusTag> },
          { title: "状态", dataIndex: "status", width: 90, render: (v: string) => <MtStatusTag tone={v === "active" ? "success" : "neutral"} showDot={v === "active"}>{v === "active" ? "启用" : "暂停"}</MtStatusTag> },
          { title: "cron", dataIndex: "cron", width: 120, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v || "-"}</span> },
          { title: "最近采集", dataIndex: "lastRunAt", width: 170, render: (v: string | null) => (v ? new Date(v).toLocaleString() : "-") },
          {
            title: "操作",
            width: 100,
            render: (_: unknown, row: Source) => (
              <Button
                size="small"
                onClick={() => {
                  setEditing(row);
                  form.setFieldsValue({ name: row.name, type: row.type, url: row.url, cron: row.cron || undefined });
                }}
              >
                编辑
              </Button>
            ),
          },
        ]}
      />
      <Modal title="新建信息源" open={creating} onCancel={() => setCreating(false)} footer={null}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api.createSource(values);
            message.success("已创建");
            setCreating(false);
            refresh();
          }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如：行业资讯 RSS" />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="rss">
            <Select options={[{ value: "rss", label: "RSS" }, { value: "json_api", label: "JSON API" }, { value: "web", label: "网页" }]} />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true }]}>
            <Input placeholder="https://example.com/feed.xml" />
          </Form.Item>
          <Form.Item name="cron" label="定时表达式（可选）">
            <Input placeholder="如 0 * * * *（每小时）" />
          </Form.Item>
          <Button type="primary" htmlType="submit">保存</Button>
        </Form>
      </Modal>
      <Modal
        title={"编辑信息源 · " + (editing?.name ?? "")}
        open={!!editing}
        onCancel={() => {
          setEditing(null);
          form.resetFields();
        }}
        onOk={async () => {
          const values = await form.validateFields();
          if (!editing) return;
          try {
            await api.updateSource(editing.id, values);
            message.success("已更新");
            setEditing(null);
            form.resetFields();
            refresh();
          } catch (err) {
            message.error(String(err));
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如：行业资讯 RSS" />
          </Form.Item>
          <Form.Item name="type" label="类型">
            <Select
              options={[
                { value: "rss", label: "RSS" },
                { value: "json_api", label: "JSON API" },
                { value: "web", label: "网页" },
              ]}
            />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true }]}>
            <Input placeholder="https://example.com/feed.xml" />
          </Form.Item>
          <Form.Item name="cron" label="定时表达式（可选）">
            <Input placeholder="如 0 * * * *（每小时）" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
