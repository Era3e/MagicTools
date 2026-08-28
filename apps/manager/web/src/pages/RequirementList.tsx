import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Requirement } from "../api";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  waiting: { label: "待分析", color: "default" },
  designing: { label: "设计中", color: "blue" },
  todo: { label: "待开发", color: "cyan" },
  developing: { label: "开发中", color: "processing" },
  testing: { label: "测试中", color: "orange" },
  accepting: { label: "待验收", color: "gold" },
  done: { label: "已完成", color: "green" },
};

const SOURCE_MAP: Record<string, { label: string; color: string }> = {
  assessor: { label: "Assessor", color: "geekblue" },
  manual: { label: "手动", color: "default" },
  github: { label: "GitHub", color: "purple" },
  cybercloud: { label: "cybercloud", color: "magenta" },
};

export default function RequirementList() {
  const [items, setItems] = useState<Requirement[]>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [source, setSource] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    api.listRequirements({ status, source }).then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, [status, source]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const poll = async () => {
    try {
      const out = await api.pollInbox();
      message.success("拉取完成：新建 " + out.created + " 条需求");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const out = await api.syncGithub("Era3e/MagicTools");
      message.success("GitHub 同步：新建 " + out.created + " 条");
      refresh();
    } catch (err) {
      message.error(String(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card
      title="需求管理"
      extra={
        <Space>
          <Select allowClear placeholder="状态" style={{ width: 120 }} value={status} onChange={setStatus}
            options={Object.entries(STATUS_MAP).map(([value, v]) => ({ value, label: v.label }))} />
          <Select allowClear placeholder="来源" style={{ width: 130 }} value={source} onChange={setSource}
            options={Object.entries(SOURCE_MAP).map(([value, v]) => ({ value, label: v.label }))} />
          <Button onClick={poll}>拉取收件箱</Button>
          <Button loading={syncing} onClick={sync}>同步 GitHub</Button>
          <Button type="primary" onClick={() => setCreating(true)}>新建需求</Button>
        </Space>
      }
    >
      <Table<Requirement>
        data-testid="requirement-table"
        rowKey="id"
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "标题", dataIndex: "title", render: (v: string, row) => <Link to={"/requirements/" + row.id}>{v}</Link> },
          { title: "状态", dataIndex: "status", width: 100, render: (v: string) => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label ?? v}</Tag> },
          { title: "来源", dataIndex: "source", width: 110, render: (v: string) => <Tag color={SOURCE_MAP[v]?.color}>{SOURCE_MAP[v]?.label ?? v}</Tag> },
          { title: "优先级", dataIndex: "priority", width: 90, render: (v: string) => <Tag color={v === "P0" ? "red" : v === "P1" ? "orange" : "default"}>{v}</Tag> },
          { title: "PR", dataIndex: "prUrl", width: 140, render: (v: string) => (v ? <a href={v} target="_blank" rel="noreferrer">查看 PR</a> : "-") },
          { title: "更新时间", dataIndex: "updatedAt", width: 170, render: (v: string) => new Date(v).toLocaleString() },
        ]}
      />
      <Modal
        title="新建需求"
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={async () => {
          setCreating(false);
          refresh();
        }}
        footer={null}
      >
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api.createRequirement(values);
            message.success("已创建");
            setCreating(false);
            refresh();
          }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="需求标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="需求描述" />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue="P2">
            <Select options={[{ value: "P0", label: "P0" }, { value: "P1", label: "P1" }, { value: "P2", label: "P2" }]} />
          </Form.Item>
          <Button type="primary" htmlType="submit">保存</Button>
        </Form>
      </Modal>
    </Card>
  );
}
