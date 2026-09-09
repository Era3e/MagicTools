import { Button, Input, Select, Table, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminPageHead, AdminToolbar, AdminToolbarCount, MtKpiRow, MtStatusTag, tokens } from "@mt/ui";
import { api, type Survey } from "../api";
import { SurveyForm, type SurveyFormValues } from "../components/SurveyForm";

export default function SurveyList() {
  const [items, setItems] = useState<Survey[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Survey | null>(null);
  const [feishu, setFeishu] = useState<{ configured: boolean; stub?: boolean } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    api.listSurveys().then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    api.feishuStatus().then(setFeishu).catch(() => setFeishu(null));
  }, [refresh]);

  const filtered = useMemo(
    () =>
      items.filter((s) => {
        if (statusFilter && s.status !== statusFilter) return false;
        if (keyword && !s.name.toLowerCase().includes(keyword.toLowerCase())) return false;
        return true;
      }),
    [items, statusFilter, keyword]
  );

  const kpis = useMemo(
    () => [
      { label: "调研主题", value: items.length, unit: "个" },
      { label: "进行中", value: items.filter((s) => s.status === "active").length, unit: "个" },
      { label: "已停用", value: items.filter((s) => s.status !== "active").length, unit: "个" },
      { label: "定时拉取", value: items.filter((s) => (s as unknown as { cron?: string }).cron).length, unit: "个" },
    ],
    [items]
  );

  const buildInitial = (s: Survey): SurveyFormValues => ({
    name: s.name,
    description: s.description || undefined,
    appToken: s.appToken || undefined,
    tableId: s.tableId || undefined,
    answerFieldsText: (s.answerFields ?? []).join(","),
  });

  return (
    <div>
      <AdminPageHead
        eyebrow="ADMIN · RESEARCH"
        title="调研管理"
        badges={
          <>
            <MtStatusTag tone={feishu?.configured ? "success" : "warning"} showDot>
              {feishu?.configured ? (feishu.stub ? "飞书桩模式" : "飞书已配置") : "飞书未配置"}
            </MtStatusTag>
            <MtStatusTag tone="neutral" mono>node-cron</MtStatusTag>
          </>
        }
        description="问卷与访谈的立卷、飞书拉取与定时调度 · 编号与时间为等宽读数"
        actions={
          <>
            <Button>导出</Button>
            <Button type="primary" onClick={() => setCreating(true)}>新建调研</Button>
          </>
        }
        kpi={<MtKpiRow items={kpis} />}
      />
      <AdminToolbar>
        <Input.Search
          allowClear
          placeholder="搜索调研名称"
          style={{ width: 240 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 120 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "active", label: "进行中" },
            { value: "paused", label: "已停用" },
          ]}
        />
        <AdminToolbarCount>共 {filtered.length} 条 · 调研列表</AdminToolbarCount>
      </AdminToolbar>
      <Table<Survey>
        rowKey="id"
        dataSource={filtered}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        columns={[
          { title: "调研编号", dataIndex: "id", width: 150, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12, fontWeight: 600, color: tokens.scale.ink[3] }}>{v.slice(0, 12)}</span> },
          { title: "名称", dataIndex: "name", render: (v: string, row) => <Link to={"/surveys/" + row.id}>{v}</Link> },
          { title: "描述", dataIndex: "description", ellipsis: true },
          { title: "状态", dataIndex: "status", width: 100, render: (v: string) => <MtStatusTag tone={v === "active" ? "success" : "neutral"} mono>{v === "active" ? "active" : "paused"}</MtStatusTag> },
          { title: "飞书推送", width: 100, render: (_: unknown, row: Survey) => <MtStatusTag tone={row.lastSyncedAt ? "success" : "neutral"} mono>{row.lastSyncedAt ? "已推送" : "未推送"}</MtStatusTag> },
          { title: "最近同步", dataIndex: "lastSyncedAt", width: 170, render: (v: string | null) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v ? new Date(v).toLocaleString() : "—"}</span> },
          {
            title: "操作",
            width: 100,
            render: (_: unknown, row: Survey) => (
              <Button type="link" size="small" style={{ paddingInline: 4 }} onClick={() => setEditing(row)}>
                编辑
              </Button>
            ),
          },
        ]}
      />
      <SurveyForm
        open={creating}
        onCancel={() => setCreating(false)}
        onSubmit={async (values) => {
          const answerFields = values.answerFieldsText
            ? values.answerFieldsText.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
          await api.createSurvey({ ...values, answerFields });
          message.success("已创建");
          setCreating(false);
          refresh();
        }}
      />
      <SurveyForm
        open={!!editing}
        title={"编辑调研主题 · " + (editing?.name ?? "")}
        initialValues={editing ? buildInitial(editing) : undefined}
        onCancel={() => setEditing(null)}
        onSubmit={async (values) => {
          if (!editing) return;
          const answerFields = values.answerFieldsText
            ? values.answerFieldsText.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
          await api.updateSurvey(editing.id, { ...values, answerFields });
          message.success("已更新");
          setEditing(null);
          refresh();
        }}
      />
    </div>
  );
}
