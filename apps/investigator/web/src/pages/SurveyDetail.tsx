import { Alert, Button, Card, Descriptions, Select, Space, Table, Tag, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type ResponseItem, type Survey } from "../api";

const SENTIMENT_MAP: Record<string, { label: string; color: string }> = {
  positive: { label: "正向", color: "green" },
  neutral: { label: "中性", color: "blue" },
  negative: { label: "负向", color: "red" },
};

export default function SurveyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [sentiment, setSentiment] = useState<string | undefined>();
  const [priority, setPriority] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!id) return;
    api.getSurvey(id).then(setSurvey).catch((err) => message.error(String(err)));
    setLoading(true);
    api.listResponses(id, { sentiment, priority }).then(setResponses).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, [id, sentiment, priority]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!survey) return <Card loading />;

  const sync = async () => {
    setSyncing(true);
    try {
      const out = await api.syncSurvey(survey.id);
      message.success("同步完成：拉取 " + out.fetchedCount + " 条，结构化 " + out.processedCount + " 条");
      refresh();
    } catch (err) {
      message.error(String(err));
    } finally {
      setSyncing(false);
    }
  };

  const summarize = async () => {
    try {
      const out = await api.summarizeSurvey(survey.id);
      setSummary(out.summary);
      message.success("总结已生成");
    } catch (err) {
      message.error(String(err));
    }
  };

  const push = async () => {
    if (selectedIds.length === 0) {
      message.warning("先勾选要推送的记录");
      return;
    }
    try {
      const out = await api.pushResponses(survey.id, selectedIds);
      message.success(
        "已推送 " +
          out.pushedCount +
          " 条至 Assessor 收件箱（researcher.response.push 事件），请通知评审在 Assessor 首页/收件箱手动拉取。"
      );
      setSelectedIds([]);
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <Card
      title={"调研 · " + survey.name}
      extra={
        <Space>
          <Button onClick={() => navigate(-1)}>返回</Button>
          <Button type="primary" loading={syncing} onClick={sync}>
            同步数据
          </Button>
          <Button onClick={summarize}>生成总结</Button>
          <Button
            onClick={async () => {
              try {
                await api.sendLink(survey.id);
                message.success("已发送到飞书群");
              } catch (err) {
                message.error(String(err));
              }
            }}
          >
            发送问卷提醒
          </Button>
        </Space>
      }
    >
      <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="状态">{survey.status}</Descriptions.Item>
        <Descriptions.Item label="app_token">{survey.appToken || "-"}</Descriptions.Item>
        <Descriptions.Item label="table_id">{survey.tableId || "-"}</Descriptions.Item>
        <Descriptions.Item label="回答字段">{(survey.answerFields ?? []).join("、") || "-"}</Descriptions.Item>
        <Descriptions.Item label="最近同步">{survey.lastSyncedAt ? new Date(survey.lastSyncedAt).toLocaleString() : "-"}</Descriptions.Item>
        <Descriptions.Item label="描述">{survey.description || "-"}</Descriptions.Item>
      </Descriptions>

      {summary || survey.summary ? (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message={summary ?? survey.summary} />
      ) : null}

      <Space style={{ marginBottom: 16 }}>
        <Select allowClear placeholder="情绪筛选" style={{ width: 140 }} value={sentiment} onChange={setSentiment}
          options={[
            { value: "positive", label: "正向" },
            { value: "neutral", label: "中性" },
            { value: "negative", label: "负向" },
          ]} />
        <Select allowClear placeholder="优先级筛选" style={{ width: 140 }} value={priority} onChange={setPriority}
          options={[
            { value: "P0", label: "P0" },
            { value: "P1", label: "P1" },
            { value: "P2", label: "P2" },
          ]} />
        <Button type="primary" onClick={push}>
          推送选中（{selectedIds.length}）
        </Button>
      </Space>

      <Table<ResponseItem>
        rowKey="id"
        dataSource={responses}
        loading={loading}
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as string[]) }}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "情绪", dataIndex: "sentiment", width: 90, render: (v: string) => <Tag color={SENTIMENT_MAP[v]?.color}>{SENTIMENT_MAP[v]?.label ?? v}</Tag> },
          { title: "优先级", dataIndex: "priority", width: 90, render: (v: string) => <Tag>{v}</Tag> },
          { title: "摘要", dataIndex: "summary", ellipsis: true },
          {
            title: "需求点",
            dataIndex: "structured",
            render: (s: Record<string, unknown>) => {
              const reqs = (s.requirements as string[]) ?? [];
              return reqs.slice(0, 3).join("、") || "-";
            },
          },
          { title: "已推送", dataIndex: "pushedAt", width: 110, render: (v: string | null) => (v ? <Tag color="green">已推送</Tag> : <Tag>未推送</Tag>) },
        ]}
        expandable={{
          expandedRowRender: (row) => (
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12 }}>
              {JSON.stringify({ rawFields: row.rawFields, structured: row.structured }, null, 2)}
            </pre>
          ),
        }}
      />
    </Card>
  );
}
