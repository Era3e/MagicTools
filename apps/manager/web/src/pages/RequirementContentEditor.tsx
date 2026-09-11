import { Alert, Button, Input, Modal, Select, Space, message } from "antd";
import { useState } from "react";
import { tokens } from "@mt/ui";
import { api, type Requirement, type RequirementRisk } from "../api";
import { RISK_LABELS } from "./RequirementContentView";

function draftFrom(item: Requirement) {
  return { title: item.title, description: item.description, project: item.project ?? "", scope: item.scope ?? "",
    risk: item.risk ?? "unassessed", acceptanceCriteria: (item.acceptanceCriteria ?? []).join("\n"),
    dependencyRefs: (item.dependencyRefs ?? []).join("\n") };
}
const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);

export default function RequirementContentEditor({ item, onClose, onUpdated }: {
  item: Requirement; onClose: () => void; onUpdated: () => Promise<void>;
}) {
  const [base, setBase] = useState(item);
  const [draft, setDraft] = useState(() => draftFrom(item));
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stale = conflict || item.id !== base.id || item.revision !== base.revision;
  const change = (field: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const reload = async () => {
    setBusy(true); setError("");
    try {
      const fresh = await api.getRequirement(base.id);
      // 父页也必须成功刷新；失败时仍保留草稿，不能默默丢弃。
      await onUpdated();
      setBase(fresh); setDraft(draftFrom(fresh)); setConflict(false);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (stale || busy) return;
    setBusy(true); setError("");
    try {
      await api.patchRequirement(base.id, { ...draft, acceptanceCriteria: lines(draft.acceptanceCriteria),
        dependencyRefs: lines(draft.dependencyRefs), expectedRevision: base.revision });
      onClose(); message.success("需求内容已保存");
      try { await onUpdated(); } catch { message.warning("内容已保存，但页面刷新失败，请重新载入"); }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if ((err as { status?: number })?.status === 409) setConflict(true);
    } finally { setBusy(false); }
  };
  return <Modal open title={`编辑第 ${base.contentRevision} 版需求内容`} width={820}
    onCancel={busy ? undefined : onClose} closable={!busy} maskClosable={false}
    footer={<Space wrap><Button disabled={busy} onClick={onClose}>取消</Button>
      {stale ? <Button loading={busy} onClick={() => { void reload(); }}>放弃草稿，重新载入</Button> : null}
      <Button type="primary" loading={busy} disabled={stale || !draft.title.trim()} onClick={() => { void save(); }}>保存内容</Button></Space>}>
    <p>修改内容将产生新修订，已有批准需要重新确认。来源证据保留原始导入记录。</p>
    {stale ? <Alert type="warning" showIcon message="服务器版本已变化，草稿已保留；请复制需要保留的内容后重新载入" /> : null}
    {error ? <Alert type="error" showIcon message={error} /> : null}
    <Space direction="vertical" size={tokens.spacing.sm} style={{ width: "100%", marginTop: tokens.spacing.md }}>
      <label htmlFor="requirement-title">标题</label><Input id="requirement-title" value={draft.title} maxLength={300} disabled={busy} onChange={(e) => change("title", e.target.value)} />
      <label htmlFor="requirement-description">描述</label><Input.TextArea id="requirement-description" rows={4} value={draft.description} maxLength={20000} disabled={busy} onChange={(e) => change("description", e.target.value)} />
      <label htmlFor="requirement-project">所属项目</label><Input id="requirement-project" value={draft.project} maxLength={64} disabled={busy} placeholder="例如 manager；小写字母、数字和连字符" onChange={(e) => change("project", e.target.value)} />
      <label htmlFor="requirement-scope">实施范围</label><Input.TextArea id="requirement-scope" rows={3} value={draft.scope} maxLength={8000} disabled={busy} onChange={(e) => change("scope", e.target.value)} />
      <label htmlFor="requirement-risk">风险评估</label><Select id="requirement-risk" aria-label="风险评估" value={draft.risk} disabled={busy} style={{ width: "100%" }}
        options={Object.entries(RISK_LABELS).map(([value, label]) => ({ value, label }))} onChange={(value: RequirementRisk) => change("risk", value)} />
      <label htmlFor="requirement-criteria">验收条件（每行一条）</label><Input.TextArea id="requirement-criteria" rows={4} value={draft.acceptanceCriteria} disabled={busy} onChange={(e) => change("acceptanceCriteria", e.target.value)} />
      <label htmlFor="requirement-dependencies">前置候选编号（每行一个）</label><Input.TextArea id="requirement-dependencies" rows={2} value={draft.dependencyRefs} disabled={busy} placeholder="例如 P07" onChange={(e) => change("dependencyRefs", e.target.value)} />
    </Space>
  </Modal>;
}
