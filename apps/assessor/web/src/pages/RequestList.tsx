import { Button, Card, Select, Space, Table, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MtStatusTag, tokens, type MtStatusTagTone } from "@mt/ui";
import { api, type AnalysisRequest } from "../api";

const STATUS_MAP: Record<string, { label: string; tone: MtStatusTagTone }> = {
  pending: { label: "待处理", tone: "neutral" },
  draft: { label: "草稿", tone: "info" },
  review: { label: "待审核", tone: "warning" },
  approved: { label: "已通过", tone: "success" },
  rejected: { label: "已驳回", tone: "error" },
};

export default function RequestList() {
  const [items, setItems] = useState<AnalysisRequest[]>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [polling, setPolling] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    api.listRequests(status).then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const poll = async () => {
    setPolling(true);
    try {
      const out = await api.pollInbox();
      message.success("拉取完成：消费 " + out.consumed + " 条，新建 " + out.created + " 个请求");
      refresh();
    } catch (err) {
      message.error(String(err));
    } finally {
      setPolling(false);
    }
  };

  return (
    <Card
      title="分析请求"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="状态筛选"
            style={{ width: 140 }}
            value={status}
            onChange={setStatus}
            options={Object.entries(STATUS_MAP).map(([value, v]) => ({ value, label: v.label }))}
          />
          <Button type="primary" loading={polling} onClick={poll}>
            拉取收件箱
          </Button>
        </Space>
      }
    >
      <Table<AnalysisRequest>
        rowKey="id"
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: "调研来源", dataIndex: "surveyName", render: (v: string, row) => <Link to={"/requests/" + row.id}>{v || "未命名"}</Link> },
          { title: "状态", dataIndex: "status", width: 100, render: (v: string) => <MtStatusTag tone={STATUS_MAP[v]?.tone ?? "neutral"}>{STATUS_MAP[v]?.label ?? v}</MtStatusTag> },
          { title: "数据条数", dataIndex: "sourceEventIds", width: 100, align: "right", render: (v: string[]) => <span style={{ fontFamily: tokens.font.mono, fontVariantNumeric: "tabular-nums" }}>{v.length}</span> },
          { title: "仓库", dataIndex: "repoUrl", width: 200, render: (v: string) => v || "-" },
          { title: "更新时间", dataIndex: "updatedAt", width: 180, render: (v: string) => new Date(v).toLocaleString() },
        ]}
      />
    </Card>
  );
}
