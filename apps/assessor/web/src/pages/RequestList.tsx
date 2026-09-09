import { Button, Select, Table, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminPageHead, AdminToolbar, AdminToolbarCount, MtKpiRow, MtStatusTag, tokens, type MtStatusTagTone } from "@mt/ui";
import { api, type AnalysisRequest } from "../api";
import BatchLab from "./BatchLab";

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

  const kpis = useMemo(
    () => [
      { label: "请求总数", value: items.length, unit: "条" },
      { label: "待处理", value: items.filter((r) => r.status === "pending").length, unit: "条" },
      { label: "待审核", value: items.filter((r) => r.status === "review").length, unit: "条" },
      { label: "已通过", value: items.filter((r) => r.status === "approved").length, unit: "条" },
    ],
    [items]
  );

  return (
    <div>
      <AdminPageHead
        eyebrow="ADMIN · REVIEWS"
        title="评审请求"
        badges={
          <>
            <MtStatusTag tone={items.some((r) => r.status === "pending") ? "warning" : "success"} showDot>
              {items.filter((r) => r.status === "pending").length} 待审
            </MtStatusTag>
            <MtStatusTag tone="neutral" mono>LLM</MtStatusTag>
          </>
        }
        description="调研产出的红笔关 · 拉取收件箱消费 researcher.response.push 事件生成评审请求"
        actions={
          <>
            <Button loading={polling} onClick={poll}>拉取收件箱</Button>
            <Button type="primary" onClick={poll}>批量分配</Button>
          </>
        }
        kpi={<MtKpiRow items={kpis} />}
      />
      <AdminToolbar>
        <Select
          allowClear
          placeholder="状态筛选"
          style={{ width: 140 }}
          value={status}
          onChange={setStatus}
          options={Object.entries(STATUS_MAP).map(([value, v]) => ({ value, label: v.label }))}
        />
        <AdminToolbarCount>共 {items.length} 条 · 评审队列</AdminToolbarCount>
      </AdminToolbar>
      <Table<AnalysisRequest>
        rowKey="id"
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        columns={[
          { title: "编号", dataIndex: "id", width: 140, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12, fontWeight: 600, color: tokens.scale.ink[3] }}>{v.slice(0, 12)}</span> },
          { title: "调研来源", dataIndex: "surveyName", render: (v: string, row) => <Link to={"/requests/" + row.id}>{v || "未命名"}</Link> },
          { title: "状态", dataIndex: "status", width: 100, render: (v: string) => <MtStatusTag tone={STATUS_MAP[v]?.tone ?? "neutral"}>{STATUS_MAP[v]?.label ?? v}</MtStatusTag> },
          { title: "数据条数", dataIndex: "sourceEventIds", width: 100, align: "right", render: (v: string[]) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{v.length}</span> },
          { title: "仓库", dataIndex: "repoUrl", width: 200, ellipsis: true, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v || "—"}</span> },
          { title: "更新时间", dataIndex: "updatedAt", width: 170, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{new Date(v).toLocaleString()}</span> },
        ]}
      />
      <BatchLab />
    </div>
  );
}
