import { Button, Input, Select, Tag, message } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Requirement, type RequirementStatus } from "../api";

const DECK = {
  ink: "#0f172a",
  sky: "#0ea5e9",
  panel: "#f8fafc",
  border: "#cbd5e1",
  muted: "#64748b",
  mono: '"Consolas", "Microsoft YaHei", monospace',
  sans: '"Segoe UI", "Microsoft YaHei", sans-serif',
};

const STATUS_OPTIONS: Array<{ value: RequirementStatus; label: string }> = [
  { value: "waiting", label: "待分析" },
  { value: "designing", label: "设计中" },
  { value: "todo", label: "待开发" },
  { value: "developing", label: "开发中" },
  { value: "testing", label: "测试中" },
  { value: "accepting", label: "待验收" },
  { value: "done", label: "已完成" },
];

const PRIORITY_COLOR: Record<string, string> = { P0: "#dc2626", P1: "#ea580c", P2: DECK.muted };

export default function RequirementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Requirement | null>(null);
  const [branch, setBranch] = useState("");
  const [prUrl, setPrUrl] = useState("");

  useEffect(() => {
    if (id) {
      api.getRequirement(id).then((r) => {
        setItem(r);
        setBranch(r.branch);
        setPrUrl(r.prUrl);
      });
    }
  }, [id]);

  if (!item) return <div style={{ fontFamily: DECK.mono, color: DECK.muted, padding: 40, textAlign: "center" }}>LOADING FLIGHT DATA…</div>;

  const refresh = async () => {
    const fresh = await api.getRequirement(item.id);
    setItem(fresh);
  };

  const changeStatus = async (status: string) => {
    await api.patchRequirement(item.id, { status });
    message.success("状态已更新");
    refresh();
  };

  const saveLinks = async () => {
    await api.patchRequirement(item.id, { branch, prUrl });
    message.success("已保存关联");
    refresh();
  };

  const refreshPr = async () => {
    try {
      const out = await api.refreshPr(item.id);
      setItem(out);
      message.success("PR 状态已刷新 → " + out.status);
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
        <span style={{ fontFamily: DECK.mono, fontSize: 12, color: PRIORITY_COLOR[item.priority] ?? DECK.muted }}>
          {item.priority}
        </span>
        <Tag style={{ borderRadius: 0 }}>{item.source}</Tag>
        {(item.labels ?? []).map((l) => (
          <span key={l} style={{ fontFamily: DECK.mono, fontSize: 11, color: DECK.muted }}>#{l}</span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16 }}>
        <div style={{ border: "1px solid " + DECK.border, background: DECK.panel, padding: "10px 12px" }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 4 }}>STATUS · 当前状态</div>
          <Select value={item.status} style={{ width: "100%" }} options={STATUS_OPTIONS} onChange={changeStatus} />
        </div>
        <div style={{ border: "1px solid " + DECK.border, background: DECK.panel, padding: "10px 12px" }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 4 }}>PRIORITY · 优先级</div>
          <Select
            value={item.priority}
            style={{ width: "100%" }}
            options={[{ value: "P0", label: "P0" }, { value: "P1", label: "P1" }, { value: "P2", label: "P2" }]}
            onChange={(v) => api.patchRequirement(item.id, { priority: v }).then(refresh)}
          />
        </div>
        <div style={{ border: "1px solid " + DECK.border, background: DECK.panel, padding: "10px 12px" }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 4 }}>BRANCH · 分支</div>
          <Input variant="borderless" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="feat-项目-任务ID" style={{ fontFamily: DECK.mono, fontSize: 12 }} />
        </div>
        <div style={{ border: "1px solid " + DECK.border, background: DECK.panel, padding: "10px 12px" }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 4 }}>PR · 关联</div>
          <Input variant="borderless" value={prUrl} onChange={(e) => setPrUrl(e.target.value)} placeholder="PR 链接" style={{ fontFamily: DECK.mono, fontSize: 12 }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Button onClick={saveLinks} style={{ borderRadius: 0 }}>保存关联</Button>
        <Button onClick={refreshPr} disabled={!item.prUrl} style={{ borderRadius: 0 }}>刷新 PR 状态</Button>
      </div>

      {item.description ? (
        <section style={{ border: "1px solid " + DECK.border, borderLeft: "3px solid " + DECK.sky, background: DECK.panel, padding: 16, marginBottom: 12 }}>
          <div style={{ fontFamily: DECK.mono, fontSize: 10, color: DECK.muted, marginBottom: 8 }}>BRIEFING · 需求描述</div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{item.description}</div>
        </section>
      ) : null}

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
