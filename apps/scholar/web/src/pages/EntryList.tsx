import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Modal, Select, Space, Switch, Table, Tag, message } from "antd";
import { api, type Entry } from "../api";

const SOURCE_MAP: Record<string, { label: string; color: string }> = {
  gatherer: { label: "Gatherer", color: "blue" },
  manual: { label: "手动", color: "green" },
  obsidian: { label: "Obsidian", color: "purple" },
};

export default function EntryList() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [source, setSource] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [scopeCategory, setScopeCategory] = useState("");
  const [creating, setCreating] = useState(false);

  const refresh = () =>
    api.listEntries({ source, category }).then(setEntries).catch((err) => message.error(String(err)));

  useEffect(() => {
    refresh();
  }, [source, category]);

  const onScope = async (id: string, assistantScope: boolean) => {
    await api.patchEntry(id, { assistantScope });
    message.success(assistantScope ? "已圈定供 Assistant 查询" : "已取消圈定");
    refresh();
  };

  return (
    <Card
      title="知识条目"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="来源筛选"
            style={{ width: 140 }}
            value={source}
            onChange={(v) => setSource(v)}
            options={[
              { value: "gatherer", label: "Gatherer" },
              { value: "manual", label: "手动" },
              { value: "obsidian", label: "Obsidian" },
            ]}
          />
          <Input placeholder="分类筛选" style={{ width: 140 }} value={category} onChange={(e) => setCategory(e.target.value || undefined)} />
          <Button onClick={() => api.pollInbox().then((r) => message.success("拉取事件：新增 " + r.created + "，跳过 " + r.skipped)).then(refresh).catch((err) => message.error(String(err)))}>
            拉取 Gatherer 事件
          </Button>
          <Button type="primary" onClick={() => setCreating(true)}>
            新增条目
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: "100%", marginBottom: 12 }}>
        <Space>
          <Input placeholder="输入分类名" style={{ width: 200 }} value={scopeCategory} onChange={(e) => setScopeCategory(e.target.value)} />
          <Button
            onClick={() =>
              scopeCategory &&
              api.scopeCategory(scopeCategory, true).then((r) => message.success("已圈定分类，更新 " + r.updated + " 条")).then(refresh).catch((err) => message.error(String(err)))
            }
          >
            圈定分类
          </Button>
          <Button
            onClick={() =>
              scopeCategory &&
              api.scopeCategory(scopeCategory, false).then((r) => message.success("已取消分类圈定，更新 " + r.updated + " 条")).then(refresh).catch((err) => message.error(String(err)))
            }
          >
            取消分类圈定
          </Button>
        </Space>
      </Space>
      <Table<Entry>
        rowKey="id"
        dataSource={entries}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "标题", dataIndex: "title" },
          {
            title: "来源",
            dataIndex: "source",
            width: 110,
            render: (v: string) => <Tag color={SOURCE_MAP[v]?.color}>{SOURCE_MAP[v]?.label ?? v}</Tag>,
          },
          { title: "分类", dataIndex: "category", width: 120, render: (v: string) => v || "-" },
          {
            title: "标签",
            dataIndex: "tags",
            width: 220,
            render: (tags: string[]) => tags.map((t) => <Tag key={t}>{t}</Tag>),
          },
          {
            title: "供 Assistant 查询",
            dataIndex: "assistantScope",
            width: 140,
            render: (v: boolean, row) => <Switch checked={v} onChange={(checked) => onScope(row.id, checked)} />,
          },
        ]}
      />
      <Modal title="新增条目" open={creating} onCancel={() => setCreating(false)} footer={null}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api.createEntry(values);
            message.success("已创建");
            setCreating(false);
            refresh();
          }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="标题" />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea placeholder="内容" rows={4} />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="分类" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="标签" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Modal>
    </Card>
  );
}
