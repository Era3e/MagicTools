import { useCallback, useEffect, useState } from "react";
import { Button, Card, Modal, Select, Space, Statistic, Table, Tag, Typography, message } from "antd";
import { DownloadOutlined, FileSearchOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { tokens } from "@mt/ui";
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

interface EvaluationData {
  confusion: { matrix: Record<string, Record<string, number>>; labels: string[]; total: number; diagHits: number };
  stats: Array<{ intent: string; total: number; corrected: number }>;
}

interface ReplayData {
  total: number;
  hits: number;
  accuracy: number;
  misses: Array<{ message: string; predicted: string; actual: string }>;
}

export default function IntentLogPage() {
  const [items, setItems] = useState<IntentLog[]>([]);
  const [domain, setDomain] = useState<string | undefined>();
  const [intent, setIntent] = useState<string | undefined>();
  const [correcting, setCorrecting] = useState<IntentLog | null>(null);
  const [corrected, setCorrected] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [datasetCount, setDatasetCount] = useState<number | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    api.listIntentLogs({ domain, intent }).then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, [domain, intent]);

  const refreshEvaluation = useCallback(() => {
    api.intentEvaluation().then(setEvaluation).catch(() => setEvaluation(null));
  }, []);

  useEffect(() => {
    refresh();
    refreshEvaluation();
  }, [refresh, refreshEvaluation]);

  const submitCorrect = async () => {
    if (!correcting || !corrected) return;
    try {
      await api.correctIntentLog(correcting.id, corrected);
      message.success("已记录纠错，few-shot 已即时更新");
      setCorrecting(null);
      setCorrected(undefined);
      refresh();
      refreshEvaluation();
    } catch (err) {
      message.error(String(err));
    }
  };

  const runReplay = async () => {
    setReplaying(true);
    try {
      const r = await api.intentReplay();
      setReplay(r);
      message.success("回放评估完成：命中率 " + Math.round(r.accuracy * 100) + "%");
    } catch (err) {
      message.error(String(err));
    } finally {
      setReplaying(false);
    }
  };

  const previewDataset = async () => {
    try {
      const r = await api.datasetPreview();
      setDatasetCount(r.count);
      message.info("数据集 " + r.count + " 条样本，已可导出 JSONL");
    } catch (err) {
      message.error(String(err));
    }
  };

  const downloadDataset = async () => {
    try {
      const r = await api.exportDataset();
      if (r.count === 0) {
        message.warning("暂无已纠错样本可导出");
        return;
      }
      const blob = new Blob([r.jsonl], { type: "application/x-ndjson" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "intent-dataset.jsonl";
      a.click();
      URL.revokeObjectURL(url);
      setDatasetCount(r.count);
      message.success("已导出 " + r.count + " 条微调样本（JSONL）");
    } catch (err) {
      message.error(String(err));
    }
  };

  const confusionPairs = evaluation?.confusion?.matrix
    ? Object.entries(evaluation.confusion.matrix).flatMap(([predicted, row]) =>
        Object.entries(row)
          .filter(([, count]) => count > 0)
          .map(([actual, count]) => ({ predicted, actual, count }))
      )
    : [];

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <Card title="路由评估（D-09 在线学习）" extra={<Tag color="blue">纠错样本 {evaluation?.confusion.total ?? 0} 条</Tag>}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Button icon={<PlayCircleOutlined />} loading={replaying} onClick={runReplay}>
            回放评估
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadDataset}>
            导出数据集
          </Button>
          <Button icon={<FileSearchOutlined />} onClick={previewDataset}>
            数据集预览
          </Button>
          {datasetCount !== null && <Tag color="green">可导出 {datasetCount} 条 JSONL</Tag>}
        </Space>
        {replay && (
          <Space wrap style={{ marginBottom: 16 }}>
            <Statistic title="回放样本" value={replay.total} />
            <Statistic title="命中" value={replay.hits} />
            <Statistic title="命中率" value={Math.round(replay.accuracy * 100) + "%"} valueStyle={{ color: replay.accuracy >= 0.8 ? tokens.color.success : tokens.color.warning }} />
          </Space>
        )}
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          混淆矩阵：行 = 原判定意图，列 = 纠错后真实意图（仅统计已纠错样本）。few-shot 每次纠错后自动吸收新样本注入分类提示词。
        </Typography.Paragraph>
        {confusionPairs.length > 0 ? (
          <Table
            rowKey={(r) => r.predicted + "-" + r.actual}
            size="small"
            dataSource={confusionPairs}
            pagination={false}
            columns={[
              { title: "原判定", dataIndex: "predicted", width: 200 },
              { title: "真实意图", dataIndex: "actual", width: 200 },
              {
                title: "数量",
                dataIndex: "count",
                width: 100,
                render: (v: number) => <Tag color={v >= 3 ? "red" : "orange"}>{v}</Tag>,
              },
            ]}
          />
        ) : (
          <Typography.Text type="secondary">暂无纠错样本，先在下表对误判消息执行纠错。</Typography.Text>
        )}
        {replay && replay.misses.length > 0 && (
          <>
            <Typography.Paragraph style={{ marginTop: 16, fontSize: 12, fontWeight: 600 }}>回放未命中明细（前 50）</Typography.Paragraph>
            <Table
              rowKey={(r) => r.message}
              size="small"
              dataSource={replay.misses}
              pagination={{ pageSize: 5 }}
              columns={[
                { title: "消息", dataIndex: "message", ellipsis: true },
                { title: "当前判定", dataIndex: "predicted", width: 180 },
                { title: "应为", dataIndex: "actual", width: 180, render: (v: string) => <Tag color="red">{v}</Tag> },
              ]}
            />
          </>
        )}
      </Card>

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
    </Space>
  );
}
