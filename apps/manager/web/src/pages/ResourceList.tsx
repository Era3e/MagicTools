import { Button, Card, Form, Input, message, Select, Table, Tag } from "antd";
import { useEffect, useState } from "react";
import { MtKpiRow, MtStatusTag, tokens } from "@mt/ui";
import { api, type OperationsResource, type ResourceSummary } from "../api";

const emptySummary: ResourceSummary = {
  total: 0,
  monthlyBudgetCents: 0,
  statusCounts: { operational: 0, failed: 0, blocked: 0, waiting: 0, unknown: 0 },
  checkCounts: { passed: 0, failed: 0, blocked: 0, waiting: 0 },
  secretRefCount: 0,
};

const statusLabels: Record<string, string> = {
  operational: "运行中",
  failed: "失败",
  blocked: "阻塞",
  waiting: "等待",
  unknown: "未检查",
};

export default function ResourceList() {
  const [items, setItems] = useState<OperationsResource[]>([]);
  const [summary, setSummary] = useState<ResourceSummary>(emptySummary);
  const [form] = Form.useForm();

  const refresh = () => api.listResources().then((data) => {
    setItems(data.items);
    setSummary(data.summary);
  });

  useEffect(() => {
    refresh().catch((error: Error) => message.error(error.message));
  }, []);

  return (
    <Card title="资源、密钥引用与运行面板">
      <div style={{ marginBottom: 20 }}>
      <MtKpiRow
        items={[
          { label: "资源", value: summary.total },
          { label: "月预算", value: (summary.monthlyBudgetCents / 100).toFixed(2), unit: "CNY" },
          { label: "阻塞检查", value: summary.checkCounts.blocked },
          { label: "等待检查", value: summary.checkCounts.waiting },
          { label: "密钥引用", value: summary.secretRefCount },
        ]}
      />
      </div>

      <Form
        form={form}
        layout="inline"
        style={{ marginBottom: 20 }}
        onFinish={async (values) => {
          try {
            await api.createResource({
              ...values,
              region: values.region ?? "",
              notes: values.notes ?? "",
              monthlyBudgetCents: Math.round(Number(values.budgetYuan || 0) * 100),
              secretRefs: values.secretRefName ? [{
                name: values.secretRefName,
                source: values.secretRefSource,
                reference: values.secretRefReference,
                required: true,
              }] : [],
            }, values.ownerToken);
            message.success("资源已登记");
            form.resetFields();
            await refresh();
          } catch (error) {
            message.error((error as Error).message);
          }
        }}
      >
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="资源名" /></Form.Item>
        <Form.Item name="kind" initialValue="host" rules={[{ required: true }]}>
          <Select style={{ width: 120 }} options={[
            { value: "host", label: "主机" },
            { value: "database", label: "数据库" },
            { value: "registry", label: "镜像库" },
            { value: "domain", label: "域名" },
            { value: "external-api", label: "外部API" },
            { value: "deployment", label: "部署" },
          ]} />
        </Form.Item>
        <Form.Item name="environment" initialValue="production" rules={[{ required: true }]}>
          <Select style={{ width: 110 }} options={[
            { value: "development", label: "开发" },
            { value: "staging", label: "预发" },
            { value: "production", label: "生产" },
          ]} />
        </Form.Item>
        <Form.Item name="owner" rules={[{ required: true }]}><Input placeholder="归属人/团队" /></Form.Item>
        <Form.Item name="provider" rules={[{ required: true }]}><Input placeholder="供应商" /></Form.Item>
        <Form.Item name="budgetYuan" rules={[{ required: true }]}><Input type="number" min={0} placeholder="月预算(元)" /></Form.Item>
        <Form.Item name="backupReference" rules={[{ required: true }]}><Input placeholder="备份定位" /></Form.Item>
        <Form.Item name="runbookUrl" rules={[{ required: true }]}><Input placeholder="处理手册 https://" /></Form.Item>
        <Form.Item name="secretRefName"><Input placeholder="密钥名" /></Form.Item>
        <Form.Item name="secretRefSource" initialValue="env">
          <Select style={{ width: 90 }} options={[
            { value: "env", label: "ENV" },
            { value: "file", label: "文件" },
            { value: "external", label: "外部" },
          ]} />
        </Form.Item>
        <Form.Item name="secretRefReference"><Input placeholder="引用，不填值" /></Form.Item>
        <Form.Item name="ownerToken" rules={[{ required: true }]}><Input type="password" placeholder="审批凭证" /></Form.Item>
        <Button type="primary" htmlType="submit">登记资源</Button>
      </Form>

      <Table<OperationsResource>
        rowKey="id"
        dataSource={items}
        pagination={false}
        columns={[
          {
            title: "资源",
            dataIndex: "name",
            render: (_value, item) => (
              <div>
                <div>{item.name}</div>
                <div style={{ color: tokens.color.textSecondary, fontSize: 12 }}>{item.provider}{item.region ? " · " + item.region : ""}</div>
              </div>
            ),
          },
          { title: "环境", dataIndex: "environment" },
          { title: "归属", dataIndex: "owner" },
          {
            title: "月预算",
            dataIndex: "monthlyBudgetCents",
            render: (value: number) => <span>{(value / 100).toFixed(2)} CNY</span>,
          },
          {
            title: "备份",
            dataIndex: "backupReference",
            render: (value: string) => <Tag>{value}</Tag>,
          },
          {
            title: "状态",
            dataIndex: "status",
            render: (value: OperationsResource["status"]) => (
              <MtStatusTag tone={value === "operational" ? "success" : value === "blocked" || value === "failed" ? "error" : "warning"}>
                {statusLabels[value] ?? value}
              </MtStatusTag>
            ),
          },
          {
            title: "检查",
            render: (_value, item) => (
              <span>
                通过 {item.checkCounts.passed} · 失败 {item.checkCounts.failed} · 阻塞 {item.checkCounts.blocked} · 等待 {item.checkCounts.waiting}
              </span>
            ),
          },
          {
            title: "密钥引用",
            render: (_value, item) => item.secretRefs.length ? item.secretRefs.map((ref) => (
              <Tag key={ref.id}>{ref.name}:{ref.reference}</Tag>
            )) : <span>—</span>,
          },
          {
            title: "处理手册",
            dataIndex: "runbookUrl",
            render: (value: string) => <a href={value} target="_blank" rel="noreferrer">打开手册</a>,
          },
        ]}
      />
    </Card>
  );
}
