import { Button, Input, Select, Table, Tabs, message } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AdminPageHead, AdminToolbar, AdminToolbarCount, MtKpiRow, tokens } from "@mt/ui";
import { api, type Position } from "../api";
import { StatusTag } from "../components/StatusTag";
import { PositionForm, type PositionFormValues } from "../components/PositionForm";
import { JdParsePanel } from "../components/JdParsePanel";
import { ImageUploadPanel } from "../components/ImageUploadPanel";
import { POSITION_STATUS_OPTIONS } from "../status";

export default function PositionList() {
  const [items, setItems] = useState<Position[]>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState<PositionFormValues | undefined>();
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");

  const refresh = useCallback(() => {
    setLoading(true);
    api.listPositions(status).then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!keyword) return items;
    const kw = keyword.toLowerCase();
    return items.filter((p) => p.company.toLowerCase().includes(kw) || p.title.toLowerCase().includes(kw) || (p.city ?? "").toLowerCase().includes(kw));
  }, [items, keyword]);

  const kpis = useMemo(
    () => [
      { label: "在招岗位", value: items.filter((p) => !["rejected", "offer"].includes(p.status)).length, unit: "个" },
      { label: "岗位总数", value: items.length, unit: "个" },
      { label: "已拿 offer", value: items.filter((p) => p.status === "offer").length, unit: "个" },
      { label: "面试中", value: items.filter((p) => p.status === "interview").length, unit: "个" },
    ],
    [items]
  );

  return (
    <div>
      <AdminPageHead
        eyebrow="ADMIN · JOBS"
        title="岗位管理"
        badges={<StatusTag status="open" />}
        description="岗位录入（手动 / JD 解析 / 截图识别）与状态流转 · 时间与计数为等宽读数"
        actions={
          <>
            <Button>导出</Button>
            <Button type="primary" onClick={() => setCreating(true)}>新建岗位</Button>
          </>
        }
        kpi={<MtKpiRow items={kpis} />}
      />
      <AdminToolbar>
        <Input.Search
          allowClear
          placeholder="搜索公司、职位、城市"
          style={{ width: 260 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 140 }}
          value={status}
          onChange={(v) => setStatus(v)}
          options={POSITION_STATUS_OPTIONS}
        />
        <AdminToolbarCount>共 {filtered.length} 条 · 岗位列表</AdminToolbarCount>
      </AdminToolbar>
      <Table<Position>
        rowKey="id"
        dataSource={filtered}
        loading={loading}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        columns={[
          { title: "公司", dataIndex: "company", render: (v: string, row) => <Link to={"/positions/" + row.id} style={{ fontWeight: 600 }}>{v}</Link> },
          { title: "职位", dataIndex: "title" },
          { title: "城市", dataIndex: "city", width: 110, render: (v: string) => v || "—" },
          { title: "状态", dataIndex: "status", width: 110, render: (v: string) => <StatusTag status={v} /> },
          { title: "更新时间", dataIndex: "updatedAt", width: 170, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{new Date(v).toLocaleString()}</span> },
          {
            title: "操作",
            width: 90,
            render: (_: unknown, row: Position) => (
              <Link to={"/positions/" + row.id} style={{ fontSize: 12 }}>
                详情
              </Link>
            ),
          },
        ]}
      />
      <PositionForm
        key={JSON.stringify(prefill ?? {})}
        open={creating}
        initialValues={prefill}
        onCancel={() => {
          setCreating(false);
          setPrefill(undefined);
        }}
        onSubmit={async (values: PositionFormValues) => {
          await api.createPosition(values);
          setCreating(false);
          setPrefill(undefined);
          refresh();
        }}
        extraPanel={
          <Tabs
            items={[
              {
                key: "manual",
                label: "手动录入",
                children: null,
              },
              {
                key: "jd",
                label: "JD 解析",
                children: (
                  <JdParsePanel
                    onParsed={(values) => {
                      setPrefill(values);
                    }}
                  />
                ),
              },
              {
                key: "image",
                label: "截图识别",
                children: (
                  <ImageUploadPanel
                    onParsed={(values) => {
                      setPrefill(values);
                    }}
                  />
                ),
              },
            ]}
          />
        }
      />
    </div>
  );
}
