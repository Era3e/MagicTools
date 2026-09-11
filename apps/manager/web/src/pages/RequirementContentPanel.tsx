import { Alert, Button, Input, Modal, Space, message } from "antd";
import { useEffect, useState } from "react";
import { MtStatusTag, tokens, useTheme } from "@mt/ui";
import { api, type ApprovalPolicy, type Requirement, type RequirementContent } from "../api";
import RequirementContentView, { contentFromRequirement, RISK_LABELS } from "./RequirementContentView";
import RequirementContentEditor from "./RequirementContentEditor";
import RequirementHistory from "./RequirementHistory";

interface ApprovalTarget { id: string; revision: number; contentRevision: number; content: RequirementContent; action: "approve" | "revoke" }

export default function RequirementContentPanel({ item, onUpdated }: { item: Requirement; onUpdated: () => Promise<void> }) {
  const theme = useTheme();
  const [policy, setPolicy] = useState<ApprovalPolicy | null>(null);
  const [policyError, setPolicyError] = useState("");
  const [target, setTarget] = useState<ApprovalTarget | null>(null);
  const [credential, setCredential] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalidated, setInvalidated] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(false);
  const stale = invalidated || Boolean(target && (target.id !== item.id || target.revision !== item.revision || target.contentRevision !== item.contentRevision));

  useEffect(() => {
    let active = true;
    api.getApprovalPolicy().then((value) => { if (active) setPolicy(value); })
      .catch(() => { if (active) setPolicyError("无法读取审批配置，请刷新页面"); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (stale) setCredential(""); }, [stale]);

  const openApproval = (action: ApprovalTarget["action"]) => {
    setCredential(""); setReason(""); setError(""); setInvalidated(false);
    setTarget({ id: item.id, revision: item.revision, contentRevision: item.contentRevision!, content: contentFromRequirement(item), action });
  };
  const closeApproval = () => { setTarget(null); setCredential(""); setReason(""); setError(""); };
  const decide = async () => {
    if (!target || stale) return;
    setBusy(true); setError("");
    try {
      const input = { expectedRevision: target.revision, expectedContentRevision: target.contentRevision, reason };
      if (target.action === "approve") await api.approveRevision(target.id, input, credential);
      else await api.revokeApproval(target.id, input, credential);
      closeApproval();
      message.success(target.action === "approve" ? "内容审批已记录" : "内容审批已撤销");
      try { await onUpdated(); } catch { message.warning("操作已记录，但页面刷新失败，请重新载入"); }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if ((err as { status?: number })?.status === 409) {
        setInvalidated(true);
        try { await onUpdated(); } catch { /* 保留已失效的审批目标，禁止自动换成新版本。 */ }
      }
    } finally { setCredential(""); setBusy(false); }
  };

  const status = item.approvalStatus ?? "unapproved";
  return <section style={{ border: "1px solid " + (theme.border ?? tokens.color.border), background: theme.panel ?? theme.background,
    padding: tokens.spacing.md, marginBottom: tokens.spacing.md }}>
    <Space wrap>
      <h3>需求内容与审批</h3>
      <MtStatusTag tone="neutral">内容修订 {item.contentRevision}</MtStatusTag>
      <MtStatusTag tone={status === "approved" ? "success" : status === "outdated" ? "warning" : "neutral"}>
        {status === "approved" ? "本版内容已批准" : status === "outdated" ? "内容已变化，需重新审批" : "本版内容待批准"}
      </MtStatusTag>
    </Space>
    <p>实施范围：{item.scope || "尚未填写"} · 风险：{RISK_LABELS[item.risk ?? "unassessed"]}</p>
    <p>审批只确认指定版本内容，不触发自动开发，也不代表需求已验收或部署。</p>
    {!item.approvalReadiness?.ready ? <Alert type="warning" showIcon message={"审批前需补齐：" + (item.approvalReadiness?.missing.join("、") || "需求内容")} /> : null}
    {policyError ? <Alert type="error" message={policyError} /> : policy && !policy.configured ? <Alert type="info" message="审批尚未启用，请配置服务端审批凭证" /> : null}
    <Space wrap style={{ marginTop: tokens.spacing.md }}>
      <Button disabled={busy} onClick={() => setEditing(true)}>编辑需求内容</Button>
      <Button onClick={() => setHistory(true)}>查看版本与审批记录</Button>
      <Button disabled={busy || !policy?.configured || !item.approvalReadiness?.ready || status === "approved"}
        onClick={() => openApproval("approve")}>批准本版内容</Button>
      {status === "approved" ? <Button disabled={busy || !policy?.configured} onClick={() => openApproval("revoke")}>撤销批准</Button> : null}
    </Space>
    {editing ? <RequirementContentEditor item={item} onClose={() => setEditing(false)} onUpdated={onUpdated} /> : null}
    {history ? <RequirementHistory key={item.id} id={item.id} onClose={() => setHistory(false)} /> : null}
    {target ? <Modal open title={target.action === "approve" ? `批准第 ${target.contentRevision} 版内容` : `撤销第 ${target.contentRevision} 版批准`}
      width={820} onCancel={busy ? undefined : closeApproval} closable={!busy} maskClosable={!busy}
      footer={<Space><Button disabled={busy} onClick={closeApproval}>取消</Button>
        <Button type="primary" loading={busy} disabled={stale || !credential} onClick={() => { void decide(); }}>
          {target.action === "approve" ? "确认批准" : "确认撤销"}</Button></Space>}>
      <div style={{ maxHeight: "50vh", overflowY: "auto" }}><RequirementContentView content={target.content} /></div>
      <p>审批身份：{policy?.actorId}（单用户凭证持有者）</p>
      {stale ? <Alert type="warning" showIcon message="页面内容或版本已变化，请关闭后查看最新内容，再重新发起审批" /> : null}
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Space direction="vertical" style={{ width: "100%", marginTop: tokens.spacing.md }}>
        <Input.Password aria-label="审批凭证" placeholder="本次审批凭证，不在浏览器持久保存" value={credential}
          disabled={busy || stale} autoComplete="off" onChange={(event) => setCredential(event.target.value)} />
        <Input.TextArea aria-label="审批说明" placeholder="审批说明（可选）" rows={2} maxLength={1000}
          value={reason} disabled={busy || stale} onChange={(event) => setReason(event.target.value)} />
      </Space>
    </Modal> : null}
  </section>;
}
