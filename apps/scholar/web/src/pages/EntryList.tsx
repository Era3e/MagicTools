import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Form, Input, Modal, Select, Skeleton, Table, message } from "antd";
import { AdminPageHead, AdminToolbar, AdminToolbarCount, MtEmptyState, MtKpiRow, MtStatusTag, tokens, useTheme } from "@mt/ui";
import { api, type Entry } from "../api";

const SOURCE_LABEL: Record<string, string> = { gatherer: "采集入藏", manual: "手稿", obsidian: "黑曜石笔记" };
const SOURCE_TONE: Record<string, "success" | "info" | "accent"> = { gatherer: "success", manual: "info", obsidian: "accent" };

type EntryFormValues = { title: string; content?: string; summary?: string; category?: string; tags?: string[] };

export default function EntryList(props: { admin?: boolean }) {
  const { admin = false } = props;
  const theme = useTheme();
  const CATALOG = {
    ink: theme.ink,
    green: theme.primary,
    muted: theme.muted,
    rule: theme.rule ?? tokens.color.border,
    paper: theme.paper ?? theme.background,
    display: theme.displayFont,
    body: theme.bodyFont,
  };
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [source, setSource] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [scopeCategory, setScopeCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form] = Form.useForm<EntryFormValues>();

  const refresh = useCallback(() => {
    api.listEntries({ source, category }).then(setEntries).catch((err) => message.error(String(err)));
  }, [source, category]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onScope = async (id: string, assistantScope: boolean) => {
    await api.patchEntry(id, { assistantScope });
    message.success(assistantScope ? "已圈定供 Assistant 查询" : "已取消圈定");
    refresh();
  };

  const openEdit = (e: Entry) => {
    setEditing(e);
    form.setFieldsValue({
      title: e.title,
      content: e.content,
      summary: e.summary || undefined,
      category: e.category || undefined,
      tags: e.tags ?? [],
    });
  };

  const filtered = useMemo(() => {
    const list = entries ?? [];
    if (!keyword) return list;
    const kw = keyword.toLowerCase();
    return list.filter((e) => e.title.toLowerCase().includes(kw) || (e.category ?? "").toLowerCase().includes(kw));
  }, [entries, keyword]);

  const kpis = useMemo(
    () => [
      { label: "在册馆藏", value: entries?.length ?? 0, unit: "卷" },
      { label: "采集入藏", value: (entries ?? []).filter((e) => e.source === "gatherer").length, unit: "卷" },
      { label: "已圈定", value: (entries ?? []).filter((e) => e.assistantScope).length, unit: "卷" },
      { label: "待摘要", value: (entries ?? []).filter((e) => !e.summary).length, unit: "卷" },
    ],
    [entries]
  );

  if (admin) {
    return (
      <div>
        <AdminPageHead
          eyebrow="ADMIN · COLLECTION"
          title="馆藏管理"
          badges={
            <>
              <MtStatusTag tone="success" showDot>服务正常</MtStatusTag>
              <MtStatusTag tone="neutral" mono>FTS</MtStatusTag>
            </>
          }
          description="在册馆藏的编目、圈定与摘要管理 · 收 Gatherer 事件自动入藏"
          actions={
            <>
              <Button onClick={() => api.pollInbox().then((r) => message.success("拉取事件：新增 " + r.created + "，跳过 " + r.skipped)).then(refresh).catch((err) => message.error(String(err)))}>
                收 Gatherer 事件
              </Button>
              <Button type="primary" onClick={() => setCreating(true)}>新建馆藏</Button>
            </>
          }
          kpi={<MtKpiRow items={kpis} />}
        />
        <AdminToolbar>
          <Input.Search
            allowClear
            placeholder="搜索标题、作者、ISBN…"
            style={{ width: 260 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            allowClear
            placeholder="来源"
            style={{ width: 130 }}
            value={source}
            onChange={(v) => setSource(v)}
            options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Input allowClear placeholder="分类" style={{ width: 120 }} value={category} onChange={(e) => setCategory(e.target.value || undefined)} />
          <AdminToolbarCount>共 {filtered.length} 条 · 馆藏列表</AdminToolbarCount>
        </AdminToolbar>
        <div data-testid="entry-rows">
          <Table<Entry>
            rowKey="id"
            dataSource={filtered}
            loading={entries === null}
            pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
            columns={[
              { title: "标题", dataIndex: "title", render: (v: string, row) => <a onClick={() => openEdit(row)} style={{ fontWeight: 600 }}>{v}</a> },
              { title: "来源", dataIndex: "source", width: 110, render: (v: string) => <MtStatusTag tone={SOURCE_TONE[v] ?? "neutral"} mono>{SOURCE_LABEL[v] ?? v}</MtStatusTag> },
              { title: "分类", dataIndex: "category", width: 120, render: (v: string) => v || "—" },
              {
                title: "摘要状态",
                width: 110,
                render: (_: unknown, row: Entry) => (
                  <MtStatusTag tone={row.summary ? "success" : "warning"}>{row.summary ? "已摘要" : "待审摘要"}</MtStatusTag>
                ),
              },
              {
                title: "圈定",
                dataIndex: "assistantScope",
                width: 90,
                render: (v: boolean) => (v ? <MtStatusTag tone="info" mono>已圈定</MtStatusTag> : <span style={{ color: tokens.dark.textFaint }}>—</span>),
              },
              { title: "标签", dataIndex: "tags", render: (v: string[]) => v.map((t) => "#" + t).join(" ") || "—" },
              {
                title: "操作",
                width: 130,
                render: (_: unknown, row: Entry) => (
                  <>
                    <Button type="link" size="small" style={{ paddingInline: 4 }} onClick={() => openEdit(row)}>
                      编辑
                    </Button>
                    <Button type="link" size="small" style={{ paddingInline: 4 }} onClick={() => onScope(row.id, !row.assistantScope)}>
                      {row.assistantScope ? "取消圈定" : "圈定"}
                    </Button>
                  </>
                ),
              },
            ]}
          />
        </div>
        {editModal()}
        {createModal()}
      </div>
    );
  }

  return (
    <div className="pg-catalog" style={{ fontFamily: CATALOG.body, color: CATALOG.ink }}>
      <style>{`
@media (max-width: 860px) {
  .pg-catalog .pg-entry { grid-template-columns: 4px minmax(0, 1fr) 150px !important; }
}
@media (max-width: 640px) {
  .pg-catalog .pg-search-row { flex-direction: column; align-items: stretch; }
  .pg-catalog .pg-search-row .ant-input-search { max-width: none !important; }
  .pg-catalog .pg-entry { grid-template-columns: 4px minmax(0, 1fr) !important; row-gap: 8px; }
  .pg-catalog .pg-entry-meta { grid-row: 2; grid-column: 2; flex-direction: row !important; align-items: center !important; flex-wrap: wrap; }
  .pg-catalog .pg-scope-row { flex-wrap: wrap; }
}
`}</style>
      <section
        style={{
          background: theme.tint ?? CATALOG.paper,
          borderTop: "3px solid " + CATALOG.green,
          borderRadius: tokens.radiusTokens.lg,
          padding: "18px 20px",
          marginBottom: tokens.spacing.md,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <h1 style={{ margin: 0, fontFamily: CATALOG.display, letterSpacing: 4, fontSize: 16 }}>馆 藏 目 录</h1>
          <span data-testid="entry-count" style={{ fontFamily: tokens.font.mono, color: CATALOG.muted, fontSize: 12 }}>
            在册 {entries?.length ?? "…"} 卷
          </span>
        </div>
        <div className="pg-search-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Input.Search
            allowClear
            placeholder="检索书名 / 分类…"
            style={{ maxWidth: 380, flex: "1 1 260px" }}
            size="large"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Select
            allowClear
            placeholder="按来源遴选"
            style={{ width: 140 }}
            value={source}
            onChange={(v) => setSource(v)}
            options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))}
          />
          <Input placeholder="按分类遴选" style={{ width: 130 }} value={category} onChange={(e) => setCategory(e.target.value || undefined)} />
          <Button
            size="small"
            type="primary"
            style={{ background: CATALOG.green, borderRadius: 0 }}
            onClick={() => setCreating(true)}
          >
            新增条目
          </Button>
        </div>
      </section>

      <div className="pg-scope-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Input placeholder="输入分类名" style={{ width: 160 }} value={scopeCategory} onChange={(e) => setScopeCategory(e.target.value)} />
        <Button
          size="small"
          onClick={() =>
            scopeCategory &&
            api.scopeCategory(scopeCategory, true).then((r) => message.success("已圈定分类，更新 " + r.updated + " 条")).then(refresh).catch((err) => message.error(String(err)))
          }
        >
          圈定分类
        </Button>
        <Button
          size="small"
          onClick={() =>
            scopeCategory &&
            api.scopeCategory(scopeCategory, false).then((r) => message.success("已取消分类圈定，更新 " + r.updated + " 条")).then(refresh).catch((err) => message.error(String(err)))
          }
        >
          取消圈定
        </Button>
        <Button size="small" onClick={() => api.pollInbox().then((r) => message.success("拉取事件：新增 " + r.created + "，跳过 " + r.skipped)).then(refresh).catch((err) => message.error(String(err)))}>
          收 Gatherer 事件
        </Button>
      </div>

      {entries === null ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : filtered.length === 0 ? (
        <MtEmptyState title="书架空空" description="先收录一卷吧" />
      ) : (
        <div data-testid="entry-rows">
          {filtered.map((e) => (
            <article
              key={e.id}
              className="pg-entry"
              style={{
                display: "grid",
                gridTemplateColumns: "4px minmax(0, 1fr) 220px",
                gap: 16,
                padding: "14px 8px",
                borderBottom: "1px solid " + CATALOG.rule,
                alignItems: "center",
              }}
            >
              <span aria-hidden style={{ width: 4, borderRadius: 2, background: e.assistantScope ? CATALOG.green : CATALOG.rule, justifySelf: "stretch" }} />
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontFamily: CATALOG.display, fontSize: 16, margin: "0 0 4px" }}>{e.title}</h3>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: CATALOG.muted }}>{SOURCE_LABEL[e.source] ?? e.source}</span>
                  {e.category ? <span style={{ color: CATALOG.muted, fontSize: 12 }}>〔{e.category}〕</span> : null}
                  {e.tags.map((t) => (
                    <span key={t} style={{ color: CATALOG.muted, fontSize: 12 }}>#{t}</span>
                  ))}
                </div>
                {e.summary ? (
                  <p style={{ margin: "6px 0 0", color: CATALOG.muted, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.summary}</p>
                ) : null}
              </div>
              <div className="pg-entry-meta" style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <MtStatusTag tone={e.summary ? "success" : "warning"}>{e.summary ? "摘要完备" : "摘要待校"}</MtStatusTag>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button size="small" style={{ borderRadius: 0, color: CATALOG.muted }} onClick={() => openEdit(e)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    type={e.assistantScope ? "primary" : "text"}
                    style={e.assistantScope ? { background: CATALOG.green, borderRadius: 0 } : { borderRadius: 0, color: CATALOG.muted }}
                    onClick={() => onScope(e.id, !e.assistantScope)}
                  >
                    {e.assistantScope ? "已圈定" : "圈定"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {createModal()}
      {editModal()}
    </div>
  );

  function createModal() {
    return (
      <Modal title="新增条目（录入手稿）" open={creating} onCancel={() => setCreating(false)} footer={null}>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            await api.createEntry(values);
            message.success("已创建");
            setCreating(false);
            refresh();
          }}
        >
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="标题" />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea placeholder="内容" rows={4} />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="分类" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="标签" />
          </Form.Item>
          <Button type="primary" htmlType="submit" style={{ background: CATALOG.green, borderRadius: 0 }}>
            保存
          </Button>
        </Form>
      </Modal>
    );
  }

  function editModal() {
    return (
      <Modal
        title={"编辑馆藏 · " + (editing?.title ?? "")}
        open={!!editing}
        onCancel={() => {
          setEditing(null);
          form.resetFields();
        }}
        onOk={async () => {
          const values = await form.validateFields();
          if (!editing) return;
          try {
            await api.patchEntry(editing.id, values);
            message.success("已更新");
            setEditing(null);
            form.resetFields();
            refresh();
          } catch (err) {
            message.error(String(err));
          }
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="标题" />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <Input.TextArea rows={2} placeholder="摘要（可选）" />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={5} placeholder="正文内容" />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="分类" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="标签" />
          </Form.Item>
        </Form>
      </Modal>
    );
  }
}
