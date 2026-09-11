import { Alert, Button, Modal, Space, Spin } from "antd";
import { useEffect, useState } from "react";
import { tokens, useTheme } from "@mt/ui";
import { api, type ApprovalEvent, type ContentRevision } from "../api";
import RequirementContentView, { CONTENT_LABELS } from "./RequirementContentView";

const ORIGIN_LABELS = { backfill: "迁移时快照", created: "创建时快照", edited: "内容修改" };
const time = (value: string) => new Date(value).toLocaleString();

export default function RequirementHistory({ id, onClose }: { id: string; onClose: () => void }) {
  const theme = useTheme();
  const [versions, setVersions] = useState<ContentRevision[]>([]);
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [nextVersion, setNextVersion] = useState<number | null>(null);
  const [nextEvent, setNextEvent] = useState<number | null>(null);
  const [earlier, setEarlier] = useState(0);
  const [later, setLater] = useState(0);
  const [loading, setLoading] = useState(true);
  const [versionBusy, setVersionBusy] = useState(false);
  const [eventBusy, setEventBusy] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [eventError, setEventError] = useState("");
  useEffect(() => {
    let active = true;
    const readVersions = api.getRequirementRevisions(id).then((page) => {
      if (!active) return;
      setVersions(page.items); setNextVersion(page.nextBefore); setTotal(page.total);
      setLater(page.items[0]?.contentRevision ?? 0); setEarlier(page.items[1]?.contentRevision ?? 0);
    }).catch(() => { if (active) setVersionError("内容历史加载失败，请关闭后重试"); });
    const readEvents = api.getApprovalHistory(id).then((page) => {
      if (active) { setEvents(page.items); setNextEvent(page.nextBefore); }
    }).catch(() => { if (active) setEventError("审批记录加载失败，请关闭后重试"); });
    void Promise.all([readVersions, readEvents]).then(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  const moreVersions = async () => {
    if (!nextVersion || versionBusy) return;
    setVersionBusy(true); setVersionError("");
    try {
      const page = await api.getRequirementRevisions(id, nextVersion);
      setVersions((old) => [...old, ...page.items]); setNextVersion(page.nextBefore); setTotal(page.total);
    } catch { setVersionError("更早修订加载失败，可以重试"); }
    finally { setVersionBusy(false); }
  };
  const moreEvents = async () => {
    if (!nextEvent || eventBusy) return;
    setEventBusy(true); setEventError("");
    try {
      const page = await api.getApprovalHistory(id, nextEvent);
      setEvents((old) => [...old, ...page.items]); setNextEvent(page.nextBefore);
    } catch { setEventError("更早审批加载失败，可以重试"); }
    finally { setEventBusy(false); }
  };
  const left = versions.find((v) => v.contentRevision === earlier);
  const right = versions.find((v) => v.contentRevision === later);
  const changed = left && right ? Object.keys(CONTENT_LABELS).filter((key) =>
    JSON.stringify(left.content[key as keyof typeof left.content]) !== JSON.stringify(right.content[key as keyof typeof right.content])) : [];
  const selectStyle = { padding: tokens.spacing.sm, color: theme.ink, background: theme.panel ?? theme.background,
    border: "1px solid " + (theme.border ?? tokens.color.border), borderRadius: tokens.radius };
  return <Modal open title="内容版本与审批记录" width={1120} onCancel={onClose} footer={<Button onClick={onClose}>关闭</Button>}>
    <p>仅展示开始记录后的内容。迁移时快照代表升级时的状态，不能还原此前修改过程。</p>
    {loading ? <Spin aria-label="正在加载历史" /> : null}
    {versionError ? <Alert type="error" message={versionError} /> : null}
    <h3>内容修订 · {total} 版</h3>
    {versions.length ? <>
      <ul>{versions.map((version) => <li key={version.contentRevision}>
        第 {version.contentRevision} 版 · <span>{ORIGIN_LABELS[version.origin]}</span> · {time(version.createdAt)}
        {version.changedFields.length ? ` · 相比前版修改：${version.changedFields.map((key) => CONTENT_LABELS[key] ?? key).join("、")}` : ""}
      </li>)}</ul>
      {nextVersion ? <Button loading={versionBusy} onClick={() => { void moreVersions(); }}>加载更早修订</Button> : null}
      <Space wrap style={{ marginTop: tokens.spacing.md }}>
        {versions.length > 1 ? <label>较早版本 <select aria-label="较早版本" value={earlier} style={selectStyle} onChange={(e) => setEarlier(Number(e.target.value))}>
          {versions.filter((v) => v.contentRevision < later).map((v) => <option key={v.contentRevision} value={v.contentRevision}>第 {v.contentRevision} 版</option>)}
        </select></label> : null}
        <label>较新版本 <select aria-label="较新版本" value={later} style={selectStyle} onChange={(e) => setLater(Number(e.target.value))}>
          {versions.filter((v) => v.contentRevision > earlier).map((v) => <option key={v.contentRevision} value={v.contentRevision}>第 {v.contentRevision} 版</option>)}
        </select></label>
      </Space>
      {left && right ? <p>所选版本差异：{changed.map((key) => CONTENT_LABELS[key]).join("、") || "内容相同"}</p> : <p>目前只有一版内容，后续修改后可进行对比。</p>}
      <section aria-label="内容版本对比" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: tokens.spacing.md }}>
        {[left, right].filter((v): v is ContentRevision => Boolean(v)).map((v) => <article key={v.contentRevision}
          style={{ border: selectStyle.border, padding: tokens.spacing.md, minWidth: 0 }}>
          <strong>第 {v.contentRevision} 版 · {ORIGIN_LABELS[v.origin]}</strong><RequirementContentView content={v.content} />
        </article>)}
      </section>
    </> : !loading && !versionError ? <p>暂无内容修订</p> : null}
    <h3>审批记录</h3>
    {eventError ? <Alert type="error" message={eventError} /> : null}
    {events.length ? <ol>{events.map((event) => <li key={event.id} style={{ marginBottom: tokens.spacing.sm, overflowWrap: "anywhere" }}>
      <strong>第 {event.contentRevision} 版 · {event.decision === "approved" ? "批准" : "撤销批准"}</strong>
      <div>{event.actorId} · 单用户凭证（{event.authMethod}） · {time(event.createdAt)}</div>
      <p style={{ whiteSpace: "pre-wrap" }}>{event.reason || "未填写说明"}</p>
    </li>)}</ol> : !loading && !eventError ? <p>暂无审批记录</p> : null}
    {nextEvent ? <Button loading={eventBusy} onClick={() => { void moreEvents(); }}>加载更早审批</Button> : null}
  </Modal>;
}
