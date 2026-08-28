import { useCallback, useEffect, useState } from "react";
import { Button, Empty, Form, Input, Modal, Select, Skeleton, Tag, message } from "antd";
import { tokens, useTheme } from "@mt/ui";
import { api, type Entry } from "../api";

const SOURCE_LABEL: Record<string, string> = { gatherer: "采集入藏", manual: "手稿", obsidian: "黑曜石笔记" };

type EntryFormValues = { title: string; content?: string; summary?: string; category?: string; tags?: string[] };

export default function EntryList() {
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

  return (
    <div style={{ fontFamily: CATALOG.body, color: CATALOG.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid " + CATALOG.ink, paddingBottom: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: CATALOG.display, letterSpacing: 4, fontSize: 13 }}>
          馆 藏 目 录
        </span>
        <span data-testid="entry-count" style={{ color: CATALOG.muted, fontSize: 12 }}>
          在册 {entries?.length ?? "…"} 卷
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <Select
          allowClear
          placeholder="按来源遴选"
          style={{ width: 140 }}
          value={source}
          onChange={(v) => setSource(v)}
          options={[
            { value: "gatherer", label: "采集入藏" },
            { value: "manual", label: "手稿" },
            { value: "obsidian", label: "黑曜石笔记" },
          ]}
        />
        <Input placeholder="按分类遴选" style={{ width: 140 }} value={category} onChange={(e) => setCategory(e.target.value || undefined)} />
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
        <Button size="small" type="primary" style={{ background: CATALOG.green, borderRadius: 0 }} onClick={() => setCreating(true)}>
          新增条目
        </Button>
      </div>

      {entries === null ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : entries.length === 0 ? (
        <Empty description={<span style={{ color: CATALOG.muted }}>书架空空——先收录一卷吧</span>} />
      ) : (
        <div data-testid="entry-rows">
          {entries.map((e) => (
            <article
            key={e.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 280px",
              gap: 16,
              padding: "14px 4px",
              borderBottom: "1px solid " + CATALOG.rule,
              alignItems: "center",
            }}
          >
            <div>
              <h3 style={{ fontFamily: CATALOG.display, fontSize: 16, margin: "0 0 4px" }}>{e.title}</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Tag style={{ borderRadius: 0 }} color="green">
                  {SOURCE_LABEL[e.source] ?? e.source}
                </Tag>
                {e.category ? <span style={{ color: CATALOG.muted, fontSize: 12 }}>〔{e.category}〕</span> : null}
                {e.tags.map((t) => (
                  <span key={t} style={{ color: CATALOG.muted, fontSize: 12 }}>#{t}</span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button
                size="small"
                style={{ borderRadius: 0, color: CATALOG.muted }}
                onClick={() => openEdit(e)}
              >
                编辑
              </Button>
              <Button
                size="small"
                type={e.assistantScope ? "primary" : "text"}
                style={e.assistantScope ? { background: CATALOG.green, borderRadius: 0 } : { borderRadius: 0, color: CATALOG.muted }}
                onClick={() => onScope(e.id, !e.assistantScope)}
              >
                {e.assistantScope ? "已圈定 · 供助手查询" : "圈定"}
              </Button>
            </div>
          </article>
          ))}
        </div>
      )}

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
    </div>
  );
}
