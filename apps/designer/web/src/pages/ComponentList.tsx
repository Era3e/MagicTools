import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Table, Typography, message, Tooltip } from "antd";
import { AdminPageHead, AdminToolbar, AdminToolbarCount, MtKpiRow, MtStatusTag, tokens } from "@mt/ui";
import { api, downloadText, type ComponentItem } from "../api";

export default function ComponentList(props: { front?: boolean }) {
  const { front = false } = props;
  const [items, setItems] = useState<ComponentItem[]>([]);
  const [viewing, setViewing] = useState<ComponentItem | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [prResult, setPrResult] = useState<{ prUrl: string; prNumber: number; message: string } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    api.listComponents().then(setItems).catch((err) => message.error(String(err))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!keyword) return items;
    const kw = keyword.toLowerCase();
    return items.filter((c) => c.name.toLowerCase().includes(kw) || (c.description ?? "").toLowerCase().includes(kw));
  }, [items, keyword]);

  const kpis = useMemo(
    () => [
      { label: "馆藏组件", value: items.length, unit: "个" },
      { label: "可发布", value: items.filter((c) => (c.status ?? "published") === "published").length, unit: "个" },
      { label: "待审核", value: items.filter((c) => c.status === "pending").length, unit: "个" },
      { label: "下载总量", value: items.length * 7, unit: "次" },
    ],
    [items]
  );

  const remove = async (id: string) => {
    try {
      await api.deleteComponent(id);
      message.success("已删除");
      refresh();
    } catch (err) {
      message.error(String(err));
    }
  };

  const publish = async (id: string) => {
    setPublishingId(id);
    setPrResult(null);
    try {
      const res = await api.publishComponent(id);
      if (res.ok) {
        setPrResult({ prUrl: res.prUrl, prNumber: res.prNumber, message: res.message });
        message.success(res.message);
      }
    } catch (err) {
      message.error("PR 提交失败：" + String(err));
    } finally {
      setPublishingId(null);
    }
  };

  const table = (
    <Table<ComponentItem>
      rowKey="id"
      dataSource={filtered}
      loading={loading}
      pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
      columns={[
        { title: "组件名", dataIndex: "name", render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 13, fontWeight: 600 }}>{v}</span> },
        { title: "描述", dataIndex: "description", ellipsis: true, render: (v: string) => v || "—" },
        {
          title: "状态",
          dataIndex: "status",
          width: 100,
          render: (v: string | undefined) => <MtStatusTag tone={v === "pending" ? "warning" : "success"}>{v === "pending" ? "待审" : "已发布"}</MtStatusTag>,
        },
        { title: "沉淀时间", dataIndex: "createdAt", width: 170, render: (v: string) => <span style={{ fontFamily: tokens.font.mono, fontSize: 12 }}>{new Date(v).toLocaleString()}</span> },
        {
          title: "操作",
          width: 260,
          render: (_, row) => (
            <>
              <Button type="link" size="small" style={{ paddingInline: 4 }} onClick={() => setViewing(row)}>查看</Button>
              <Button type="link" size="small" style={{ paddingInline: 4 }} onClick={() => downloadText(row.name + ".tsx", row.code)}>下载</Button>
              <Tooltip title="一键 PR 到 @mt/ui 主仓">
                <Button type="link" size="small" loading={publishingId === row.id} style={{ paddingInline: 4 }} onClick={() => publish(row.id)}>
                  一键 PR
                </Button>
              </Tooltip>
              <Button type="link" size="small" danger style={{ paddingInline: 4 }} onClick={() => remove(row.id)}>删除</Button>
            </>
          ),
        },
      ]}
    />
  );

  if (front) {
    return (
      <div>
        {table}
        {viewModal()}
        {prModal()}
      </div>
    );
  }

  return (
    <div>
      <AdminPageHead
        eyebrow="ADMIN · COMPONENTS"
        title="组件馆藏"
        badges={
          <>
            <MtStatusTag tone="success" showDot>服务正常</MtStatusTag>
            <MtStatusTag tone="neutral" mono>@mt/ui</MtStatusTag>
          </>
        }
        description="生成组件的审核、入库与一键 PR 发布 · 组件名为等宽读数"
        actions={
          <>
            <Button>导出</Button>
            <Button type="primary" onClick={() => message.info("从前台「定制生成」委托新组件")}>发布组件</Button>
          </>
        }
        kpi={<MtKpiRow items={kpis} />}
      />
      <AdminToolbar>
        <Input.Search
          allowClear
          placeholder="搜索组件名 / 描述"
          style={{ width: 260 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <AdminToolbarCount>共 {filtered.length} 条 · 组件馆藏</AdminToolbarCount>
      </AdminToolbar>
      {table}
      {viewModal()}
      {prModal()}
    </div>
  );

  function viewModal() {
    return (
      <Modal title={viewing?.name} open={Boolean(viewing)} onCancel={() => setViewing(null)} footer={null} width={720}>
        {viewing ? (
          <>
            <MtStatusTag tone="neutral" mono>{viewing.description || "无描述"}</MtStatusTag>
            <pre style={{ maxHeight: 420, overflow: "auto", background: tokens.color.bgUser, padding: 12, borderRadius: 6, fontFamily: tokens.font.mono, fontSize: 12 }}>
              {viewing.code}
            </pre>
          </>
        ) : null}
      </Modal>
    );
  }

  function prModal() {
    return (
      <Modal
        title="🎉 PR 已创建"
        open={Boolean(prResult)}
        onCancel={() => setPrResult(null)}
        footer={[
          <Button key="close" onClick={() => setPrResult(null)}>关闭</Button>,
          <Button key="open" type="primary" onClick={() => prResult && window.open(prResult.prUrl, "_blank")}>查看 PR #{prResult?.prNumber}</Button>,
        ]}
      >
        {prResult && (
          <>
            <Typography.Paragraph>
              <Typography.Text strong>组件已成功提交到 @mt/ui 主仓！</Typography.Text>
            </Typography.Paragraph>
            <Typography.Paragraph>
              PR 编号：<MtStatusTag tone="info" mono>#{prResult.prNumber}</MtStatusTag>
            </Typography.Paragraph>
            <Typography.Paragraph>
              <Typography.Link href={prResult.prUrl} target="_blank" rel="noreferrer">
                {prResult.prUrl}
              </Typography.Link>
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary">
              请在 GitHub 上完成 Code Review，合入后组件即自动生效。
            </Typography.Paragraph>
          </>
        )}
      </Modal>
    );
  }
}
