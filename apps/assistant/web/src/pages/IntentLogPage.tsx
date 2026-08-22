import { useCallback, useEffect, useState } from "react";
import { Button, Card, Modal, Select, Space, Table, Tag, message } from "antd";
import { api, type IntentLog } from "../api";

const DOMAIN_LABEL: Record<string, { label: string; color: string }> = {
  cybercloud: { label: "cybercloud", color: "purple" },
  magictools: { label: "MagicTools", color: "blue" },
  chitchat: { label: "闲聊", color: "default" },
};

const DOMAINS = ["cybercloud", "magictools", "chitchat"];

const INTENT_OPTIONS = [
  { value: "product_inquiry", label: "product_inquiry 知识问答" },
  { value: "data_query", label: "data_query 数据/cybercloud" },
  { value: "chitchat_reject", label: "chitchat_reject 闲聊" },
  { value: "process_execution", label: "process_execution 流程执行" },
  { value: "trouble_shooting", label: "trouble_shooting 排查" },
  { value: "complaint_feedback", label: "complaint_feedback 反馈" },
];

export default function IntentLogPage() {
  const [items, setItems] = useState<IntentLog[]>([]);
  const [domain, setDomain] = useState<string | undefined>();
  const [intent, setIntent] = useState<string | undefined>();
  const [correcting, setCorrecting] = useState<IntentLog | null>(null);
  const [corrected, setCorrected] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    api.listIntentLogs({ domain, intent }).then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, [domain, intent]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submitCorrect = async () => {
    if (!correcting || !corrected) return;
    try {
      await api.correctIntentLog(correcting.id, corrected);
      message.success("已记录纠错");
      setCorrecting(null);
      setCorrected(undefined);
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card title="意图日志">
      <Space style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="系统筛选"
          style={{ width: 160 }}
          value={domain}
          onChange={(v) => setDomain(v)}
          options={DOMAINS.map((d) => ({ value: d, label: d }))}
        />
        <Select
          allowClear
          placeholder="意图筛选"
          style={{ width: 220 }}
          value={intent}
          onChange={(v) => setIntent(v)}
          options={INTENT_OPTIONS}
        />
      </Space>
      <Table<IntentLog>
        rowKey="id"
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "消息", dataIndex: "message", ellipsis: true },
          {
            title: "系统",
            dataIndex: "domain",
            width: 120,
            render: (v: string) => <Tag color={DOMAIN_LABEL[v]?.color}>{DOMAIN_LABEL[v]?.label ?? v}</Tag>,
          },
          { title: "意图", dataIndex: "intent", width: 180 },
          {
            title: "置信度",
            dataIndex: "confidence",
            width: 90,
            render: (v: number) => (v < 0.6 ? <Tag color="orange">{v}</Tag> : <Tag color="green">{v}</Tag>),
          },
          {
            title: "纠错",
            dataIndex: "correctedIntent",
            width: 180,
            render: (v: string | null) => (v ? <Tag color="red">{v}</Tag> : "-"),
          },
          {
            title: "操作",
            width: 100,
            render: (_, row) => (
              <Button
                size="small"
                onClick={() => {
                  setCorrecting(row);
                  setCorrected(row.correctedIntent ?? undefined);
                }}
              >
                纠错
              </Button>
            ),
          },
        ]}
      />
      <Modal title="纠错意图" open={Boolean(correcting)} onCancel={() => setCorrecting(null)} footer={null}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Select
            style={{ width: "100%" }}
            placeholder="选择正确意图"
            value={corrected}
            onChange={(v) => setCorrected(v)}
            options={INTENT_OPTIONS}
          />
          <Button type="primary" onClick={submitCorrect}>
            确定
          </Button>
        </Space>
      </Modal>
    </Card>
  );
}
