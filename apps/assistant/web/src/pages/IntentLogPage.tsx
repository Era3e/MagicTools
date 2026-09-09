import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Modal, Select, Table, Typography, message } from "antd";
import { DownloadOutlined, FileSearchOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { AdminPageHead, MtStatusTag, MtKpiRow, MtEmptyState, tokens } from "@mt/ui";
import { api, type IntentLog, type CybercloudCall } from "../api";

const DOMAIN_LABEL: Record<string, { label: string }> = {
  cybercloud: { label: "cybercloud" },
  magictools: { label: "MagicTools" },
  chitchat: { label: "闲聊" },
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

function callStats(list: CybercloudCall[], route: string) {
  const rows = list.filter((c) => c.route === route);
  if (rows.length === 0) {
    return { rate: "--", avg: "--" };
  }
  const okCount = rows.filter((c) => c.ok).length;
  const avg = Math.round(rows.reduce((sum, c) => sum + c.latencyMs, 0) / rows.length);
  return { rate: Math.round((okCount / rows.length) * 100) + "%", avg: String(avg) };
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
  const [calls, setCalls] = useState<CybercloudCall[]>([]);

  const refresh = useCallback(() => {
    setLoading(true);
    api.listIntentLogs({ domain, intent }).then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, [domain, intent]);

  const refreshEvaluation = useCallback(() => {
    api.intentEvaluation().then(setEvaluation).catch(() => setEvaluation(null));
  }, []);

  const refreshCalls = useCallback(() => {
    api.listCybercloudCalls().then((r) => setCalls(Array.isArray(r) ? r : [])).catch((err) => {
      console.error(err);
      setCalls([]);
    });
  }, []);

  useEffect(() => {
    refresh();
    refreshEvaluation();
    refreshCalls();
  }, [refresh, refreshEvaluation, refreshCalls]);

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

  const agentStats = callStats(calls, "agent");
  const directStats = callStats(calls, "direct");

  const intentDist = useMemo(() => {
    const byKey = new Map<string, number>();
    for (const it of items) byKey.set(it.intent, (byKey.get(it.intent) ?? 0) + 1);
    const total = items.length || 1;
    return [...byKey.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, n]) => ({
        name,
        n,
        pct: Math.round((n / total) * 100),
      }));
  }, [items]);

  const lowConf = useMemo(() => items.filter((i) => i.confidence < 0.6).length, [items]);
  const correctedCount = items.filter((i) => i.correctedIntent).length;

  return (
    <div>
      <AdminPageHead
        eyebrow="ADMIN · INTENT"
        title="意图日志 · 路由评估"
        badges={<MtStatusTag tone={evaluation ? "success" : "neutral"} showDot>{evaluation ? "在线学习已启用" : "评估待生成"}</MtStatusTag>}
        description="纠错样本自动注入 few-shot · 回放评估与 JSONL 数据集导出（D-09）"
        actions={
          <>
            <Button icon={<PlayCircleOutlined />} loading={replaying} onClick={runReplay}>回放评估</Button>
            <Button icon={<DownloadOutlined />} onClick={downloadDataset}>导出数据集</Button>
            <Button icon={<FileSearchOutlined />} onClick={previewDataset}>数据集预览</Button>
          </>
        }
        kpi={
          <MtKpiRow
            items={[
              { label: "本页样本", value: items.length, unit: "条" },
              { label: "低置信（<0.6）", value: lowConf, unit: "条" },
              { label: "已纠错", value: correctedCount, unit: "条" },
              ...(replay
                ? [
                    {
                      label: "回放命中率",
                      value: Math.round(replay.accuracy * 100) + "%",
                      delta: replay.accuracy >= 0.8 ? "达标" : "低于阈值 80%",
                      deltaTone: (replay.accuracy >= 0.8 ? "up" : "flat") as "up" | "flat",
                    },
                  ]
                : []),
            ]}
          />
        }
      />

      {intentDist.length > 0 && (
        <div style={{ marginBottom: tokens.spacing.md }}>
          <div style={{ fontFamily: tokens.font.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.color.textSecondary, marginBottom: tokens.spacing.sm }}>
            INTENT · 本页意图分布
          </div>
          <div style={{ display: "grid", gap: tokens.spacing.sm }}>
            {intentDist.map((d) => (
              <div key={d.name} style={{ display: "flex", alignItems: "center", gap: tokens.spacing.sm }}>
                <MtStatusTag mono style={{ minWidth: 220 }}>{d.name}</MtStatusTag>
                <div style={{ flex: 1, height: 4, background: tokens.color.bgUser, borderRadius: tokens.radiusTokens.full, overflow: "hidden", minWidth: 0 }}>
                  <div style={{ width: d.pct + "%", height: "100%", background: tokens.color.primary, borderRadius: tokens.radiusTokens.full }} />
                </div>
                <span style={{ fontFamily: tokens.font.mono, fontSize: 12, color: tokens.color.textSecondary, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {d.n} · {d.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {datasetCount !== null && (
        <div style={{ marginBottom: tokens.spacing.md }}>
          <MtStatusTag tone="success">可导出 {datasetCount} 条 JSONL</MtStatusTag>
        </div>
      )}

      {replay && (
        <div style={{ marginBottom: tokens.spacing.md }}>
          <Typography.Paragraph style={{ marginTop: 0, fontSize: 12, fontWeight: 600, marginBottom: tokens.spacing.sm }}>
            回放读数 · 样本 {replay.total} / 命中 {replay.hits}
          </Typography.Paragraph>
          <MtKpiRow
            items={[
              { label: "回放样本", value: replay.total, unit: "条" },
              { label: "命中", value: replay.hits, unit: "条" },
              {
                label: "命中率",
                value: Math.round(replay.accuracy * 100) + "%",
                delta: replay.accuracy >= 0.8 ? "达标" : "低于阈值 80%",
                deltaTone: replay.accuracy >= 0.8 ? "up" : "flat",
              },
            ]}
          />
        </div>
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
            style={{ marginBottom: tokens.spacing.md }}
            columns={[
              { title: "原判定", dataIndex: "predicted", width: 200 },
              { title: "真实意图", dataIndex: "actual", width: 200 },
              {
                title: "数量",
                dataIndex: "count",
                width: 100,
                align: "right",
                render: (v: number) => <MtStatusTag tone={v >= 3 ? "error" : "warning"} mono>{v}</MtStatusTag>,
              },
            ]}
          />
        ) : (
          <Typography.Text type="secondary" style={{ display: "block", marginBottom: tokens.spacing.md }}>暂无纠错样本，先在下表对误判消息执行纠错。</Typography.Text>
        )}
        {replay && replay.misses.length > 0 && (
          <div style={{ marginBottom: tokens.spacing.md }}>
            <Typography.Paragraph style={{ marginTop: 0, fontSize: 12, fontWeight: 600 }}>回放未命中明细（前 50）</Typography.Paragraph>
            <Table
              rowKey={(r) => r.message}
              size="small"
              dataSource={replay.misses}
              pagination={{ pageSize: 5 }}
              columns={[
                { title: "消息", dataIndex: "message", ellipsis: true },
                { title: "当前判定", dataIndex: "predicted", width: 180 },
                { title: "应为", dataIndex: "actual", width: 180, render: (v: string) => <MtStatusTag tone="error" mono>{v}</MtStatusTag> },
              ]}
            />
          </div>
        )}

      <div style={{ display: "flex", gap: tokens.spacing.sm, marginBottom: tokens.spacing.md, flexWrap: "wrap", alignItems: "center" }}>
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
          <span style={{ marginLeft: "auto", fontFamily: tokens.font.mono, fontSize: 12, color: tokens.color.textSecondary }}>
            本页 {items.length} 条 · 每页 10 条
          </span>
        </div>
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
              render: (v: string) => <MtStatusTag tone={v === "cybercloud" ? "accent" : v === "magictools" ? "info" : "neutral"} mono>{DOMAIN_LABEL[v]?.label ?? v}</MtStatusTag>,
            },
            { title: "意图", dataIndex: "intent", width: 180, render: (v: string) => <MtStatusTag mono>{v}</MtStatusTag> },
            {
              title: "置信度",
              dataIndex: "confidence",
              width: 90,
              align: "right",
              render: (v: number) => <MtStatusTag tone={v < 0.6 ? "warning" : "success"} mono>{v}</MtStatusTag>,
            },
            {
              title: "纠错",
              dataIndex: "correctedIntent",
              width: 180,
              render: (v: string | null) => (v ? <MtStatusTag tone="error" mono>{v}</MtStatusTag> : "-"),
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
          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacing.md }}>
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
          </div>
        </Modal>
      <div style={{ marginTop: tokens.spacing.xl }}>
          <div style={{ fontFamily: tokens.font.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.color.textSecondary, marginBottom: tokens.spacing.md }}>
            DATA · 数据查询监控（近 {calls.length} 条调用）
          </div>
          <div style={{ marginBottom: 16 }}>
            <MtKpiRow
              items={[
                { label: "agent 成功率", value: agentStats.rate },
                { label: "agent 平均延迟", value: agentStats.avg, unit: agentStats.avg === "--" ? undefined : "ms" },
                { label: "direct 成功率", value: directStats.rate },
                { label: "direct 平均延迟", value: directStats.avg, unit: directStats.avg === "--" ? undefined : "ms" },
              ]}
            />
          </div>
          {calls.length > 0 ? (
            <Table<CybercloudCall>
              rowKey="id"
              size="small"
              dataSource={calls}
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: "时间",
                  dataIndex: "createdAt",
                  width: 180,
                  render: (v: string) => <MtStatusTag mono>{v.replace("T", " ").replace("Z", "")}</MtStatusTag>,
                },
                {
                  title: "路由",
                  dataIndex: "route",
                  width: 100,
                  render: (v: string) => <MtStatusTag mono>{v}</MtStatusTag>,
                },
                { title: "endpoint", dataIndex: "endpoint", render: (v: string) => <MtStatusTag mono>{v}</MtStatusTag> },
                {
                  title: "状态",
                  dataIndex: "ok",
                  width: 90,
                  render: (v: boolean) => (v ? <MtStatusTag tone="success">成功</MtStatusTag> : <MtStatusTag tone="error">失败</MtStatusTag>),
                },
                {
                  title: "延迟",
                  dataIndex: "latencyMs",
                  width: 110,
                  align: "right",
                  render: (v: number) => <MtStatusTag mono>{v} ms</MtStatusTag>,
                },
                {
                  title: "error",
                  dataIndex: "error",
                  ellipsis: true,
                  render: (v: string | null) => (v ? <MtStatusTag tone="error" mono>{v}</MtStatusTag> : "-"),
                },
              ]}
            />
          ) : (
            <MtEmptyState title="暂无数据查询调用" description="对话页发起数据查询后，双路（agent/direct）调用会在此记录。" />
          )}
      </div>
    </div>
  );
}
