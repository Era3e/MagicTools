import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Table, message } from "antd";
import { AdminPageHead, AdminToolbar, AdminToolbarCount, MtKpiRow, MtStatusTag, tokens } from "@mt/ui";
import { api, downloadText, type Generation } from "../api";

export default function HistoryList() {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    api.listGenerations().then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const kpis = useMemo(
    () => [
      { label: "生成总数", value: items.length, unit: "次" },
      { label: "成功", value: items.filter((g) => g.status === "ok").length, unit: "次" },
      { label: "失败", value: items.filter((g) => g.status !== "ok").length, unit: "次" },
      { label: "沉淀组件", value: new Set(items.filter((g) => g.componentName).map((g) => g.componentName)).size, unit: "个" },
    ],
    [items]
  );

  return (
    <div>
      <AdminPageHead
        eyebrow="ADMIN · HISTORY"
        title="生成历史"
        badges={<MtStatusTag tone="neutral" mono>GEN</MtStatusTag>}
        description="自然语言到组件的生成流水线记录 · 成功件可下载 TSX 源码"
        kpi={<MtKpiRow items={kpis} />}
      />
      <AdminToolbar>
        <AdminToolbarCount>共 {items.length} 条 · 生成流水</AdminToolbarCount>
      </AdminToolbar>
      <Table<Generation>
        rowKey="id"
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        columns={[
          { title: "委托描述", dataIndex: "prompt", ellipsis: true },
          { title: "组件", dataIndex: "componentName", width: 180, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{v || "—"}</span> },
          {
            title: "状态",
            dataIndex: "status",
            width: 100,
            render: (v: string) => <MtStatusTag tone={v === "ok" ? "success" : "error"}>{v === "ok" ? "成功" : "失败"}</MtStatusTag>,
          },
          {
            title: "时间",
            dataIndex: "createdAt",
            width: 170,
            render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{new Date(v).toLocaleString()}</span>,
          },
          {
            title: "操作",
            width: 100,
            render: (_, row) =>
              row.status === "ok" && row.code ? (
                <Button type="link" size="small" style={{ paddingInline: 4 }} onClick={() => downloadText(row.componentName + ".tsx", row.code)}>
                  下载
                </Button>
              ) : (
                <span style={{ color: tokens.dark.textFaint }}>—</span>
              ),
          },
        ]}
      />
    </div>
  );
}
