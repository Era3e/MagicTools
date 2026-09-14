import { Button, Checkbox, Form, Input, Modal, Select, Table, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminPageHead, AdminToolbar, AdminToolbarCount, MtKpiRow, MtStatusTag, tokens, type MtStatusTagTone } from "@mt/ui";
import { api, type DeadLetter, type SchedulerTask, type Source } from "../api";
import FailLab from "./FailLab";

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
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [keyword, setKeyword] = useState("");
  const [schedulerTasks, setSchedulerTasks] = useState<SchedulerTask[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [form] = Form.useForm<{ name: string; type: string; url: string; cron?: string; autoPush?: boolean }>();

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([api.listSources(), api.schedulerStatus(), api.listDeadLetters()])
      .then(([sources, scheduler, dead]) => {
        setItems(sources);
        setSchedulerTasks(scheduler.tasks);
        setDeadLetters(dead);
      })
      .catch((err) => message.error(String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(
    () =>
      items.filter((s) => {
        if (typeFilter && s.type !== typeFilter) return false;
        if (statusFilter && s.status !== statusFilter) return false;
        if (keyword && !s.name.toLowerCase().includes(keyword.toLowerCase()) && !s.url.toLowerCase().includes(keyword.toLowerCase())) return false;
        return true;
      }),
    [items, typeFilter, statusFilter, keyword]
  );

  const kpis = useMemo(
    () => [
      { label: "在册源", value: items.length, unit: "个" },
      { label: "运行中", value: items.filter((s) => s.status === "active").length, unit: "个" },
      { label: "已暂停", value: items.filter((s) => s.status !== "active").length, unit: "个" },
      { label: "已注册调度", value: schedulerTasks.filter((task) => task.registered).length, unit: "个" },
    ],
    [items, schedulerTasks]
  );

  const toggleStatus = async (row: Source) => {
    try {
      await api.updateSource(row.id, { status: row.status === "active" ? "paused" : "active" });
      message.success(row.status === "active" ? "已暂停采集" : "已恢复采集");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <div>
      <AdminPageHead
        eyebrow="ADMIN · SOURCES"
        title="采集源管理"
        badges={
          <>
            <MtStatusTag tone="success" showDot>服务正常</MtStatusTag>
            <MtStatusTag tone="neutral" mono>outbox</MtStatusTag>
          </>
        }
        description="RSS / JSON API / 网页三类源的登记、定时采集与暂停控制 · 时间与计数为等宽读数"
        actions={
          <>
            <Button onClick={() => setCreating(true)}>导出</Button>
            <Button type="primary" onClick={() => setCreating(true)}>新增采集源</Button>
          </>
        }
        kpi={<MtKpiRow items={kpis} />}
      />
      <AdminToolbar>
        <Input.Search
          allowClear
          placeholder="搜索名称 / URL"
          style={{ width: 260 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          size="middle"
        />
        <Select
          allowClear
          placeholder="类型"
          style={{ width: 130 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={Object.entries(TYPE_MAP).map(([value, v]) => ({ value, label: v.label }))}
        />
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 120 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "active", label: "运行中" },
            { value: "paused", label: "已暂停" },
          ]}
        />
        <AdminToolbarCount>共 {filtered.length} 条 · 源列表</AdminToolbarCount>
      </AdminToolbar>
      <Table<Source>
        data-testid="source-table"
        rowKey="id"
        dataSource={filtered}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        columns={[
          {
            title: "源名称",
            dataIndex: "name",
            render: (v: string, row) => <Link to={"/sources/" + row.id}>{v}</Link>,
          },
          { title: "类型", dataIndex: "type", width: 110, render: (v: string) => <MtStatusTag tone={TYPE_MAP[v]?.tone ?? "neutral"} mono>{TYPE_MAP[v]?.label ?? v}</MtStatusTag> },
          {
            title: "状态",
            dataIndex: "status",
            width: 110,
            render: (v: string) => (
              <MtStatusTag tone={v === "active" ? "success" : "neutral"} showDot={v === "active"}>
                {v === "active" ? "运行中" : "已暂停"}
              </MtStatusTag>
            ),
          },
          { title: "Cron", dataIndex: "cron", width: 130, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: v ? undefined : tokens.dark.textFaint }}>{v || "—"}</span> },
          {
            title: "自动推送",
            dataIndex: "options",
            width: 100,
            render: (value: Record<string, unknown>) => (
              <MtStatusTag tone={value?.autoPush ? "success" : "neutral"} mono>
                {value?.autoPush ? "开启" : "关闭"}
              </MtStatusTag>
            ),
          },
          { title: "URL", dataIndex: "url", width: 220, ellipsis: true, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v}</span> },
          { title: "最近采集", dataIndex: "lastRunAt", width: 170, render: (v: string | null) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v ? new Date(v).toLocaleString() : "—"}</span> },
          {
            title: "操作",
            width: 170,
            render: (_: unknown, row: Source) => (
              <>
                <Button
                  type="link"
                  size="small"
                  style={{ paddingInline: 4 }}
                  onClick={() => {
                    setEditing(row);
                    form.setFieldsValue({ name: row.name, type: row.type, url: row.url, cron: row.cron || undefined, autoPush: row.options?.autoPush === true });
                  }}
                >
                  编辑
                </Button>
                <Button type="link" size="small" style={{ paddingInline: 4 }} onClick={() => toggleStatus(row)}>
                  {row.status === "active" ? "暂停" : "启用"}
                </Button>
                <Link to={"/sources/" + row.id + "/items"} style={{ paddingInline: 4, fontSize: 12 }}>
                  条目
                </Link>
              </>
            ),
          },
        ]}
      />
      <section aria-labelledby="operations-title" style={{ marginTop: tokens.spacing.xl }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: tokens.spacing.md, marginBottom: tokens.spacing.md }}>
          <h2 id="operations-title" style={{ margin: 0, fontFamily: tokens.font.display, fontSize: 22, fontWeight: 600 }}>
            调度实况
          </h2>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.dark.textFaint }}>SCHEDULER · DEAD LETTERS</span>
        </div>
        <Table<SchedulerTask>
          rowKey="sourceId"
          dataSource={schedulerTasks}
          pagination={false}
          size="small"
          locale={{ emptyText: "暂无有效定时源" }}
          columns={[
            { title: "源名称", dataIndex: "name" },
            { title: "Cron", dataIndex: "cron", width: 130, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v || "—"}</span> },
            {
              title: "注册状态",
              dataIndex: "registered",
              width: 110,
              render: (v: boolean) => (
                <MtStatusTag tone={v ? "success" : "warning"} showDot={v}>
                  {v ? "已注册" : "未注册"}
                </MtStatusTag>
              ),
            },
            {
              title: "最近运行",
              dataIndex: "lastRunStatus",
              width: 130,
              render: (v: SchedulerTask["lastRunStatus"]) => (
                <MtStatusTag tone={v === "success" ? "success" : v === "dead" ? "error" : v === "running" ? "info" : "neutral"}>
                  {v === "not_run" ? "未运行" : v}
                </MtStatusTag>
              ),
            },
            {
              title: "拉取 / 新增",
              width: 110,
              render: (_: unknown, row) => (
                <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>
                  {row.lastRunFetchedCount === null ? "—" : `${row.lastRunFetchedCount} / ${row.lastRunNewCount}`}
                </span>
              ),
            },
            {
              title: "运行时间",
              dataIndex: "lastRunAt",
              width: 170,
              render: (v: string | null) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v ? new Date(v).toLocaleString() : "—"}</span>,
            },
            { title: "错误", dataIndex: "lastRunError", ellipsis: true, render: (v: string | null) => <span style={{ fontSize: 12 }}>{v || "—"}</span> },
          ]}
        />
        <h3 style={{ margin: `${tokens.spacing.lg} 0 ${tokens.spacing.md}`, fontSize: 16 }}>死信追踪</h3>
        <Table<DeadLetter>
          rowKey="id"
          dataSource={deadLetters}
          pagination={false}
          size="small"
          locale={{ emptyText: "暂无死信" }}
          columns={[
            { title: "来源", dataIndex: "sourceId", width: 220, ellipsis: true, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v}</span> },
            { title: "运行", dataIndex: "runId", width: 220, ellipsis: true, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v}</span> },
            { title: "错误", dataIndex: "error", ellipsis: true },
            {
              title: "事件状态",
              dataIndex: "status",
              width: 130,
              render: (v: string, row) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v} · {row.attempts}次</span>,
            },
            {
              title: "发生时间",
              dataIndex: "occurredAt",
              width: 170,
              render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{new Date(v).toLocaleString()}</span>,
            },
          ]}
        />
      </section>
      <FailLab />
      <Modal title="新增采集源" open={creating} onCancel={() => setCreating(false)} footer={null}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api.createSource({ ...values, options: { autoPush: values.autoPush === true } });
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
          <Form.Item name="autoPush" label="采集后自动推送" valuePropName="checked" initialValue={false}>
            <Checkbox>新条目写入后立即推送 Scholar</Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit">保存</Button>
        </Form>
      </Modal>
      <Modal
        title={"编辑采集源 · " + (editing?.name ?? "")}
        open={!!editing}
        onCancel={() => {
          setEditing(null);
          form.resetFields();
        }}
        onOk={async () => {
          const values = await form.validateFields();
          if (!editing) return;
          try {
            await api.updateSource(editing.id, { ...values, options: { ...editing.options, autoPush: values.autoPush === true } });
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
          <Form.Item name="autoPush" label="采集后自动推送" valuePropName="checked">
            <Checkbox>新条目写入后立即推送 Scholar</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
