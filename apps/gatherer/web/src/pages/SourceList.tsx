import { Button, Card, Form, Input, Modal, Select, Table, Tag, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Source } from "../api";

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  rss: { label: "RSS", color: "green" },
  json_api: { label: "JSON API", color: "blue" },
  web: { label: "网页", color: "purple" },
};

export default function SourceList() {
  const [items, setItems] = useState<Source[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

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
        rowKey="id"
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "名称", dataIndex: "name", render: (v: string, row) => <Link to={"/sources/" + row.id}>{v}</Link> },
          { title: "类型", dataIndex: "type", width: 110, render: (v: string) => <Tag color={TYPE_MAP[v]?.color}>{TYPE_MAP[v]?.label ?? v}</Tag> },
          { title: "状态", dataIndex: "status", width: 90, render: (v: string) => <Tag color={v === "active" ? "green" : "default"}>{v === "active" ? "启用" : "暂停"}</Tag> },
          { title: "cron", dataIndex: "cron", width: 120, render: (v: string) => v || "-" },
          { title: "最近采集", dataIndex: "lastRunAt", width: 170, render: (v: string | null) => (v ? new Date(v).toLocaleString() : "-") },
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
    </Card>
  );
}
