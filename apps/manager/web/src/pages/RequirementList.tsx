import { Button, Form, Input, Modal, Select, Space, Table, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminPageHead, MtStatusTag, MtKpiRow, tokens, type MtStatusTagTone } from "@mt/ui";
import { api, type Requirement } from "../api";

const STATUS_MAP: Record<string, { label: string; tone: MtStatusTagTone }> = {
  waiting: { label: "待分析", tone: "neutral" },
  designing: { label: "设计中", tone: "info" },
  todo: { label: "待开发", tone: "info" },
  developing: { label: "开发中", tone: "accent" },
  testing: { label: "测试中", tone: "warning" },
  accepting: { label: "待验收", tone: "accent" },
  done: { label: "已完成", tone: "success" },
};

const SOURCE_MAP: Record<string, { label: string }> = {
  assessor: { label: "Assessor" },
  manual: { label: "手动" },
  github: { label: "GitHub" },
  cybercloud: { label: "cybercloud" },
};

const PRIORITY_TONE: Record<string, MtStatusTagTone> = { P0: "error", P1: "warning", P2: "neutral" };

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

  const stats = useMemo(() => {
    const done = items.filter((r) => r.status === "done").length;
    const p0 = items.filter((r) => r.priority === "P0").length;
    const withPr = items.filter((r) => r.prUrl).length;
    return [
      { label: "在轨需求", value: items.length, unit: "条" },
      { label: "已完成", value: done, unit: "条" },
      { label: "P0 在轨", value: p0, unit: "条" },
      { label: "挂 PR", value: withPr, unit: "条" },
    ];
  }, [items]);

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
    <div>
      <AdminPageHead
        eyebrow="ADMIN · REQUIREMENTS"
        title="需求管理"
        badges={<MtStatusTag tone="info">七态生命周期</MtStatusTag>}
        description="待分析 → 设计 → 开发 → 测试 → 验收 → 完成 · 数字为等宽读数"
        actions={
          <>
            <Button onClick={poll}>拉取收件箱</Button>
            <Button loading={syncing} onClick={sync}>同步 GitHub</Button>
            <Button type="primary" onClick={() => setCreating(true)}>新建需求</Button>
          </>
        }
        kpi={<MtKpiRow items={stats} />}
      />
      <div style={{ display: "flex", gap: tokens.spacing.sm, marginBottom: tokens.spacing.md, flexWrap: "wrap", alignItems: "center" }}>
        <Select allowClear placeholder="状态" style={{ width: 120 }} value={status} onChange={setStatus}
          options={Object.entries(STATUS_MAP).map(([value, v]) => ({ value, label: v.label }))} />
        <Select allowClear placeholder="来源" style={{ width: 130 }} value={source} onChange={setSource}
          options={Object.entries(SOURCE_MAP).map(([value, v]) => ({ value, label: v.label }))} />
        <span style={{ marginLeft: "auto", fontFamily: tokens.font.mono, fontSize: 12, color: tokens.color.textSecondary }}>
          共 {items.length} 条 · 每页 10 条
        </span>
      </div>
      <Table<Requirement>
        data-testid="requirement-table"
        rowKey="id"
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "标题", dataIndex: "title", render: (v: string, row) => <Link to={"/requirements/" + row.id}>{v}</Link> },
          { title: "状态", dataIndex: "status", width: 100, render: (v: string) => <MtStatusTag tone={STATUS_MAP[v]?.tone ?? "neutral"}>{STATUS_MAP[v]?.label ?? v}</MtStatusTag> },
          { title: "来源", dataIndex: "source", width: 110, render: (v: string) => <MtStatusTag tone="neutral" mono>{SOURCE_MAP[v]?.label ?? v}</MtStatusTag> },
          { title: "优先级", dataIndex: "priority", width: 90, render: (v: string) => <MtStatusTag tone={PRIORITY_TONE[v] ?? "neutral"} mono>{v}</MtStatusTag> },
          { title: "PR", dataIndex: "prUrl", width: 140, render: (v: string) => (v ? <a href={v} target="_blank" rel="noreferrer">查看 PR</a> : "-") },
          { title: "更新时间", dataIndex: "updatedAt", width: 170, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{new Date(v).toLocaleString()}</span> },
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
          <Space>
            <Button onClick={() => setCreating(false)}>取消</Button>
            <Button type="primary" htmlType="submit">保存</Button>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
