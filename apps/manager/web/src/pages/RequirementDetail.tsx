import { Alert, Button, Input, Select, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MtStatusTag, tokens, useTheme } from "@mt/ui";
import { api, type Requirement, type RequirementStatus } from "../api";

const STATUS_OPTIONS: Array<{ value: RequirementStatus; label: string }> = [
  { value: "waiting", label: "待分析" },
  { value: "designing", label: "设计中" },
  { value: "todo", label: "待开发" },
  { value: "developing", label: "开发中" },
  { value: "testing", label: "测试中" },
  { value: "accepting", label: "待验收" },
  { value: "done", label: "已完成" },
];

/** 优先级颜色：P0/P1 使用 tokens 语义色，P2 使用应用 muted */
function priorityColor(priority: string, muted: string): string {
  if (priority === "P0") return tokens.color.error;
  if (priority === "P1") return tokens.color.warning;
  return muted;
}

function linkSnapshot(item: Requirement) {
  return { branch: item.branch, prUrl: item.prUrl, baseBranch: item.branch, basePrUrl: item.prUrl, revision: item.revision };
}

export default function RequirementDetail() {
  const theme = useTheme();
  const DECK = {
    ink: theme.ink,
    sky: theme.primary,
    panel: theme.panel ?? theme.background,
    border: theme.border ?? tokens.color.border,
    muted: theme.muted,
    mono: theme.displayFont,
    sans: theme.bodyFont,
  };
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Requirement | null>(null);
  const [links, setLinks] = useState({ branch: "", prUrl: "", baseBranch: "", basePrUrl: "", revision: 0 });
  const [savingLinks, setSavingLinks] = useState(false);
  const { branch, prUrl } = links;

  useEffect(() => {
    if (id) {
      api.getRequirement(id).then((r) => {
        setItem(r);
        setLinks(linkSnapshot(r));
      });
    }
  }, [id]);

  if (!item) return <div style={{ fontFamily: DECK.mono, color: DECK.muted, padding: 40, textAlign: "center" }}>LOADING FLIGHT DATA…</div>;

  const refresh = async (resetLinks = false) => {
    const fresh = await api.getRequirement(item.id);
    setItem(fresh);
    setLinks((draft) => {
      const dirty = draft.branch !== draft.baseBranch || draft.prUrl !== draft.basePrUrl;
      if (resetLinks || !dirty) return linkSnapshot(fresh);
      // 仅当服务器关联仍等于草稿基准时，允许将草稿重放到新修订。
      if (fresh.branch === draft.baseBranch && fresh.prUrl === draft.basePrUrl) {
        return { ...draft, revision: fresh.revision };
      }
      return draft;
    });
  };

  const changeStatus = async (status: string) => {
    try {
      await api.patchRequirement(item.id, { status, expectedRevision: item.revision });
      message.success("状态已更新");
    } catch (error) {
      message.error(String(error));
    }
    await refresh();
  };

  const saveLinks = async () => {
    setSavingLinks(true);
    try {
      await api.patchRequirement(item.id, { branch, prUrl, expectedRevision: links.revision });
      message.success("已保存关联");
      await refresh(true);
    } catch (error) {
      message.error(String(error));
      await refresh();
    } finally {
      setSavingLinks(false);
    }
  };

  const refreshPr = async () => {
    try {
      await api.refreshPr(item.id);
      await refresh();
      message.success("PR 状态已刷新");
    } catch (err) {
      message.error(String(err));
    }
  };

  return (
    <div style={{ fontFamily: DECK.sans, color: DECK.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontFamily: DECK.mono, letterSpacing: 3, color: DECK.sky, fontSize: 12 }}>
          FLIGHT LOG · 需求档案
        </span>
        <Button type="text" onClick={() => navigate(-1)} style={{ fontFamily: DECK.mono, fontSize: 12 }}>
          ← 返回看板
        </Button>
      </div>
      <div style={{ height: 2, background: DECK.ink, marginBottom: 16 }} />

      <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{item.title}</h2>
        <span style={{ fontFamily: DECK.mono, fontSize: 12, color: priorityColor(item.priority, DECK.muted) }}>
          {item.priority}
        </span>
        <MtStatusTag tone="neutral" mono>{item.source}</MtStatusTag>
        {(item.labels ?? []).map((l) => (
          <span key={l} style={{ fontFamily: DECK.mono, fontSize: 11, color: DECK.muted }}>#{l}</span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
        <div style={{ border: "1px solid " + DECK.border, background: DECK.panel, padding: "10px 12px" }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 4 }}>STATUS · 当前状态</div>
          <Select value={item.status} style={{ width: "100%" }} options={STATUS_OPTIONS.map((option) => ({
            ...option, disabled: option.value !== item.status && !item.allowedNextStatuses?.includes(option.value),
          }))} onChange={changeStatus} />
        </div>
        <div style={{ border: "1px solid " + DECK.border, background: DECK.panel, padding: "10px 12px" }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 4 }}>PRIORITY · 优先级</div>
          <Select
            value={item.priority}
            style={{ width: "100%" }}
            options={[{ value: "P0", label: "P0" }, { value: "P1", label: "P1" }, { value: "P2", label: "P2" }]}
            onChange={(v) => api.patchRequirement(item.id, { priority: v, expectedRevision: item.revision })
              .then(() => refresh()).catch((error) => { message.error(String(error)); void refresh(); })}
          />
        </div>
        <div style={{ border: "1px solid " + DECK.border, background: DECK.panel, padding: "10px 12px" }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 4 }}>BRANCH · 分支</div>
          <Input variant="borderless" disabled={savingLinks} value={branch} onChange={(e) => setLinks((draft) => ({ ...draft, branch: e.target.value }))} placeholder="feat-项目-任务ID" style={{ fontFamily: DECK.mono, fontSize: 12 }} />
        </div>
        <div style={{ border: "1px solid " + DECK.border, background: DECK.panel, padding: "10px 12px" }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 4 }}>PR · 关联</div>
          <Input variant="borderless" disabled={savingLinks} value={prUrl} onChange={(e) => setLinks((draft) => ({ ...draft, prUrl: e.target.value }))} placeholder="PR 链接" style={{ fontFamily: DECK.mono, fontSize: 12 }} />
        </div>
      </div>

      {links.revision !== item.revision ? <Alert type="warning" showIcon
        message="服务器关联已变化，当前草稿尚未保存。请重新载入关联后再编辑。"
        description={`服务器分支：${item.branch || "未关联"}；PR：${item.prUrl || "未关联"}`}
        action={<Button onClick={() => { void refresh(true); }}>重新载入关联</Button>} /> : null}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Button loading={savingLinks} onClick={saveLinks} style={{ borderRadius: 0 }}>保存关联</Button>
        <Button onClick={refreshPr} disabled={!item.prUrl} style={{ borderRadius: 0 }}>刷新 PR 状态</Button>
      </div>

      {item.description ? (
        <section style={{ border: "1px solid " + DECK.border, borderLeft: "3px solid " + DECK.sky, background: DECK.panel, padding: 16, marginBottom: 12 }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 8 }}>BRIEFING · 需求描述</div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{item.description}</div>
        </section>
      ) : null}

      {item.acceptanceCriteria?.length || item.evidenceRefs?.length ? <section
        style={{ border: "1px solid " + DECK.border, background: DECK.panel, padding: tokens.spacing.md, marginBottom: tokens.spacing.md }}>
        <h3>验收与实现证据</h3>
        <p>项目：{item.project || "未指定"} · 修订 {item.revision} · 人工开发</p>
        {item.acceptanceCriteria?.length ? <ul>{item.acceptanceCriteria.map((criterion, i) => <li key={i}>{criterion}</li>)}</ul> : null}
        {item.evidenceRefs?.map((e, i) => <div key={i}><a href={e.url} target="_blank" rel="noreferrer">{e.path}:{e.line}</a></div>)}
        {item.dependencyRefs?.length ? <p>前置候选：{item.dependencyRefs.join("、")}（需在排期时核验）</p> : null}
      </section> : null}

      {item.sourcePayload ? (
        <details style={{ border: "1px dashed " + DECK.border, padding: "8px 12px", marginBottom: 12 }}>
          <summary style={{ fontFamily: DECK.mono, fontSize: 11, color: DECK.muted, cursor: "pointer" }}>
            SOURCE DATA · 来源详情（Assessor 事件）
          </summary>
          <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", fontSize: 12, fontFamily: DECK.mono }}>
            {JSON.stringify(item.sourcePayload, null, 2)}
          </pre>
        </details>
      ) : null}

      {item.timeline.length > 0 ? (
        <section style={{ border: "1px solid " + DECK.border, padding: 16 }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 12 }}>
            FLIGHT LOG · 状态时间线
          </div>
          {[...item.timeline].reverse().map((t, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "6px 0", borderBottom: i < item.timeline.length - 1 ? "1px dashed " + DECK.border : undefined }}>
              <span style={{ fontFamily: DECK.mono, fontSize: 12, color: DECK.muted }}>
                {new Date(t.at).toLocaleString()}
              </span>
              <span style={{ fontFamily: DECK.mono, fontSize: 12 }}>
                {t.from} → <b style={{ color: DECK.sky }}>{t.to}</b>
                {t.note ? <span style={{ color: DECK.muted }}>（{t.note}）</span> : null}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
