import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, message } from "antd";
import { api, type Conversation, type Message, type VerifyResult } from "../api";
import { MtStatusTag, useTheme, tokens, type MtStatusTagTone } from "@mt/ui";

const INTENT_LABEL: Record<string, string> = {
  product_inquiry: "知识问答",
  data_query: "数据查询",
  chitchat_reject: "闲聊",
  process_execution: "流程执行",
  trouble_shooting: "故障排查",
  complaint_feedback: "反馈",
};

export const VERIFY_POLL_MS = 2000;

const VERIFY_LABEL: Record<string, string> = {
  pending: "直连数据 · 核验中",
  consistent: "已核验 · 智能体一致",
  divergent: "智能体回答不一致 · 已采用直连",
  unverifiable: "智能体未给出可比数值 · 已采用直连",
  agent_failed: "智能体故障 · 已采用直连",
  agent_timeout: "智能体超时 · 已采用直连",
  not_applicable: "来自智能体 · 直连不适用",
};

const VERIFY_TONE: Record<string, MtStatusTagTone> = {
  pending: "neutral",
  consistent: "success",
  divergent: "warning",
  unverifiable: "neutral",
  agent_failed: "error",
  agent_timeout: "error",
  not_applicable: "info",
};

/** 错误码 → 重试策略（设计稿错误码矩阵） */
interface ErrSpec {
  code: string;
  desc: string;
  autoRetry: boolean;
  maxRetry: number;
  cooldown?: number;
  retryable: boolean;
}

const ERR_SPECS: Record<string, ErrSpec> = {
  "ERR-NET-001": { code: "ERR-NET-001", desc: "网络连接中断，请检查网络后重试", autoRetry: true, maxRetry: 3, retryable: true },
  "ERR-GW-504": { code: "ERR-GW-504", desc: "服务响应超时，稍等片刻再试一次", autoRetry: true, maxRetry: 3, retryable: true },
  "ERR-LLM-502": { code: "ERR-LLM-502", desc: "模型服务暂时不可用，正在自动恢复", autoRetry: true, maxRetry: 3, retryable: true },
  "ERR-LLM-429": { code: "ERR-LLM-429", desc: "当前提问人数较多，请稍候 15 秒再试", autoRetry: false, maxRetry: 3, cooldown: 15, retryable: true },
  "ERR-SAFE-451": { code: "ERR-SAFE-451", desc: "该请求未通过内容安全检查", autoRetry: false, maxRetry: 0, retryable: false },
};

/** 消息扩展态：本地失败气泡（不阻塞新发送） */
interface FailedState {
  errCode: keyof typeof ERR_SPECS | string;
  retryCount: number;
  maxRetry: number;
  cooldownLeft?: number;
}

export default function ChatPage() {
  const theme = useTheme();
  const QUIET = {
    ink: theme.ink,
    accent: theme.accent ?? theme.primary,
    tint: theme.tint ?? theme.paper ?? theme.background,
    muted: theme.muted,
    panel: theme.panel ?? "#ffffff",
    bubbleUser: theme.bubbleUser ?? theme.tint ?? theme.background,
    bubbleBot: theme.bubbleBot ?? theme.panel ?? "#ffffff",
    border: theme.border ?? theme.muted,
    sans: theme.bodyFont,
    display: theme.displayFont,
  };
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  /** 失败态按消息 id 索引 */
  const [failures, setFailures] = useState<Record<string, FailedState>>({});
  /** typing 指示（重试中/发送中） */
  const [typing, setTyping] = useState(false);
  const [attemptLabel, setAttemptLabel] = useState<string | null>(null);
  const [sysBar, setSysBar] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const refreshConversations = () =>
    api.listConversations().then(setConversations).catch((err) => message.error(String(err)));

  useEffect(() => {
    refreshConversations();
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const open = async (id: string) => {
    setActiveId(id);
    setMessages(await api.getMessages(id).catch((err) => {
      message.error(String(err));
      return [] as Message[];
    }));
  };

  /** 构造失败气泡（演示状态机：failed-auto 静默一次 → failed-idle 可见） */
  const injectFailure = (errCode: string, userText: string) => {
    const spec = ERR_SPECS[errCode] ?? { code: errCode, desc: "服务暂时不可用", autoRetry: true, maxRetry: 3, retryable: true };
    const msgId = "local-a" + Date.now();
    setMessages((prev) => [
      ...prev,
      { id: "local-u" + Date.now(), conversationId: activeId ?? "", role: "user", content: userText, intent: "", citations: [], createdAt: new Date().toISOString() },
      { id: msgId, conversationId: activeId ?? "", role: "assistant", content: "", intent: "", citations: [], createdAt: new Date().toISOString() },
    ]);
    setFailures((prev) => ({ ...prev, [msgId]: { errCode, retryCount: 0, maxRetry: spec.maxRetry, cooldownLeft: spec.cooldown } }));
    if (spec.cooldown) startCooldown(msgId, spec.cooldown);
    return msgId;
  };

  const startCooldown = (msgId: string, seconds: number) => {
    let left = seconds;
    const timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(timer);
        setFailures((prev) => {
          const next = { ...prev };
          if (next[msgId]) next[msgId] = { ...next[msgId], cooldownLeft: undefined };
          return next;
        });
      } else {
        setFailures((prev) => {
          const next = { ...prev };
          if (next[msgId]) next[msgId] = { ...next[msgId], cooldownLeft: left };
          return next;
        });
      }
    }, 1000);
  };

  const sendText = async (text: string) => {
    if (!text || sending) return;
    setSysBar(null);
    setSending(true);
    try {
      const res = await api.chat({ sessionId: activeId ?? undefined, message: text });
      setActiveId(res.sessionId);
      setMessages((prev) => [
        ...prev,
        { id: "local-u" + Date.now(), conversationId: res.sessionId, role: "user", content: text, intent: "", citations: [], createdAt: new Date().toISOString() },
        { id: "local-a" + Date.now(), conversationId: res.sessionId, role: "assistant", content: res.reply, intent: res.intent, citations: res.citations, actionResult: res.actionResult, clarifying: res.clarifying, clarifyOptions: res.clarifyOptions, verify: res.verify, createdAt: new Date().toISOString() },
      ]);
      refreshConversations();
    } catch (err) {
      // 失败不阻塞新发送：落错误气泡
      const msgId = injectFailure("ERR-GW-504", text);
      message.error(String(err));
      void msgId;
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await sendText(text);
  };

  const remove = async (id: string) => {
    try {
      await api.deleteConversation(id);
      message.success("已删除会话");
      if (activeId === id) {
        setActiveId(null);
        setMessages([]);
      }
      refreshConversations();
    } catch (err) {
      message.error(String(err));
    }
  };

  /** 重试：错误气泡淡出 → typing + ATTEMPT n/3 → 模拟成功（真实环境走 api 重发） */
  const retry = async (msgId: string) => {
    const fail = failures[msgId];
    if (!fail) return;
    const spec = ERR_SPECS[fail.errCode];
    if (fail.cooldownLeft) return;
    if (spec && !spec.retryable) return;
    if (fail.retryCount >= fail.maxRetry) return;

    setFailures((prev) => {
      const next = { ...prev };
      delete next[msgId];
      return next;
    });
    setTyping(true);
    const attempt = fail.retryCount + 1;
    setAttemptLabel("ATTEMPT " + attempt + "/" + fail.maxRetry);

    // 演示恢复流：800ms 后成功输出（真实环境为重发请求）
    setTimeout(async () => {
      setTyping(false);
      setAttemptLabel(null);
      const userText = messages.find((m) => m.id === msgId.replace("local-a", "local-u"))?.content ?? "重试的问题";
      try {
        const res = await api.chat({ sessionId: activeId ?? undefined, message: userText });
        setActiveId(res.sessionId);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== msgId),
          { id: "local-a" + Date.now(), conversationId: res.sessionId, role: "assistant", content: res.reply, intent: res.intent, citations: res.citations, actionResult: res.actionResult, clarifying: res.clarifying, clarifyOptions: res.clarifyOptions, createdAt: new Date().toISOString() },
        ]);
        refreshConversations();
      } catch {
        // 三次耗尽 → 系统提示条
        if (attempt >= fail.maxRetry) {
          setSysBar("助手服务可能不稳定，可查看服务状态");
        } else {
          setFailures((prev) => ({ ...prev, [msgId]: { ...fail, retryCount: attempt } }));
        }
      }
    }, 800);
  };

  /** 换个问法：回填输入框 */
  const rephrase = (msgId: string) => {
    const userText = messages.find((m) => m.id === msgId.replace("local-a", "local-u"))?.content;
    if (userText) {
      setDraft(userText);
      window.setTimeout(() => {
        const el = document.querySelector<HTMLInputElement>(".pg-composer input");
        el?.focus();
        el?.select();
      }, 50);
    }
  };

  const sessions = useMemo(() => conversations.slice(0, 12), [conversations]);

  return (
    <div className="pg-chat" style={{ display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: 16, fontFamily: QUIET.sans, color: QUIET.ink, alignItems: "stretch" }}>
      <style>{`
@media (max-width: 920px) {
  .pg-chat { grid-template-columns: minmax(0, 1fr) !important; }
  .pg-chat-sessions { flex-direction: row !important; overflow-x: auto; padding-bottom: 6px; }
  .pg-chat-sessions > * { flex: 0 0 auto; }
  .pg-chat-session-list { flex-direction: row !important; gap: 8px !important; }
  .pg-chat-session { flex: 0 0 200px; }
  .pg-chat-stream { max-height: 420px !important; }
}
@media (max-width: 640px) {
  .pg-chat-stream { gap: 12px !important; }
  .pg-chat-head { flex-direction: column; gap: 2px; align-items: flex-start !important; }
  .pg-chat-send { padding-inline: 0 !important; }
}
`}</style>
      {/* 左栏：会话列表 */}
      <aside
        className="pg-chat-sessions"
        style={{
          background: QUIET.bubbleBot,
          border: "1px solid " + QUIET.border,
          borderRadius: tokens.radiusTokens.lg,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 360,
        }}
      >
        <Button
          block
          type="primary"
          style={{ background: QUIET.accent, height: 38, fontWeight: 600 }}
          onClick={() => { setActiveId(null); setMessages([]); setFailures({}); }}
        >
          ＋ 新对话
        </Button>
        <span className="pg-chat-session-list" style={{ fontFamily: tokens.font.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: QUIET.muted }}>历史会话</span>
        <div className="pg-chat-session-list" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {sessions.length === 0 ? (
            <span style={{ fontSize: 12, color: QUIET.muted, padding: "6px 2px" }}>暂无历史会话</span>
          ) : (
            sessions.map((c) => {
              const active = c.id === activeId;
              return (
                <div
                  key={c.id}
                  className="pg-chat-session"
                  onClick={() => open(c.id)}
                  style={{
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: tokens.radiusTokens.md,
                    background: active ? QUIET.tint : "transparent",
                    position: "relative",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {active ? <span aria-hidden style={{ position: "absolute", left: 0, top: 9, bottom: 9, width: 2, borderRadius: 1, background: QUIET.accent }} /> : null}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? QUIET.ink : QUIET.muted }}>
                    {c.title || "未命名会话"}
                  </span>
                  <span
                    role="button"
                    aria-label="删除"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); remove(c.id); }}
                    style={{ color: QUIET.muted, fontSize: 11, flexShrink: 0, cursor: "pointer" }}
                  >
                    ✕
                  </span>
                </div>
              );
            })
          )}
        </div>
        <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: QUIET.muted, borderTop: "1px solid " + QUIET.border, paddingTop: 8 }}>
          intents · data_query / trouble / knowledge / ticket
        </span>
      </aside>

      {/* 右栏：对话舞台 */}
      <section
        style={{
          background: QUIET.panel,
          border: "1px solid " + QUIET.border,
          borderRadius: tokens.radiusTokens.lg,
          display: "flex",
          flexDirection: "column",
          minHeight: 360,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 16px", borderBottom: "1px solid " + QUIET.border }}>
          <span style={{ fontFamily: QUIET.display, fontSize: 15, fontWeight: 600 }}>{activeId ? "会话" : "新对话"}</span>
          <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: QUIET.muted }}>{activeId ? activeId.slice(0, 12) : "CHAT-NEW"}</span>
        </div>

        <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14, minHeight: 220, maxHeight: 480 }}>
          {messages.length === 0 && !typing ? (
            <div style={{ textAlign: "center", marginTop: 60, color: QUIET.muted }}>
              <div style={{ fontFamily: QUIET.display, fontSize: 34, marginBottom: 8 }}>◇</div>
              开始对话吧
              <div style={{ fontSize: 12, marginTop: 4, fontFamily: tokens.font.mono }}>知识问答 · 数据查询 · 故障排查</div>
            </div>
          ) : null}
          {messages.map((m) => {
            const fail = m.role === "assistant" ? failures[m.id] : undefined;
            if (fail) {
              const spec = ERR_SPECS[fail.errCode];
              const exhausted = fail.retryCount >= fail.maxRetry;
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div
                    role="alert"
                    style={{
                      maxWidth: "min(600px, 100%)",
                      padding: "12px 14px",
                      borderRadius: "14px 14px 14px 2px",
                      background: tokens.scale.error[0],
                      border: "1px solid " + tokens.scale.error[2],
                      color: tokens.scale.error[7],
                      fontSize: 14,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginBottom: 4 }}>
                      <span aria-hidden>▲</span>回复生成失败
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>{spec?.desc ?? "服务暂时不可用"}</div>
                    <div style={{ fontFamily: tokens.font.mono, fontSize: 11, opacity: 0.75, margin: "6px 0" }}>
                      {fail.errCode} · {new Date().toLocaleTimeString("zh-CN", { hour12: false })}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {spec?.retryable !== false ? (
                        <Button
                          size="small"
                          danger
                          disabled={!!fail.cooldownLeft || exhausted}
                          onClick={() => retry(m.id)}
                          style={{ height: 30 }}
                        >
                          {fail.cooldownLeft
                            ? `重试（${fail.cooldownLeft}s）`
                            : exhausted
                              ? `已重试 ${fail.maxRetry} 次`
                              : fail.retryCount === 0
                                ? "重试"
                                : `重试（${fail.retryCount + 1}/${fail.maxRetry}）`}
                        </Button>
                      ) : null}
                      <a onClick={() => rephrase(m.id)} style={{ fontSize: 12, textDecoration: "underline", textUnderlineOffset: 4, cursor: "pointer" }}>
                        换个问法
                      </a>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "min(600px, 100%)",
                    padding: "10px 14px",
                    borderRadius: m.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    background: m.role === "user" ? QUIET.tint : QUIET.bubbleBot,
                    border: m.role === "user" ? "none" : "1px solid " + QUIET.border,
                    whiteSpace: "pre-wrap",
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: QUIET.ink,
                  }}
                >
                  {m.content}
                  {m.role === "assistant" && m.intent ? (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: QUIET.accent, fontFamily: tokens.font.mono }}>— {INTENT_LABEL[m.intent] ?? m.intent}</span>
                    </div>
                  ) : null}
                  {m.role === "assistant" && m.verify ? <VerifyBadge verify={m.verify} /> : null}
                  {m.role === "assistant" && m.actionResult?.ok ? (
                    <div style={{ marginTop: 4, fontSize: 11, color: QUIET.muted }}>
                      动作已执行：{String(m.actionResult.action ?? "")}
                    </div>
                  ) : null}
                  {m.role === "assistant" && m.clarifying && m.clarifyOptions ? (
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {m.clarifyOptions.map((o) => (
                        <Button key={o.intent} size="small" onClick={() => sendText(o.intent)}>
                          {o.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  {(m.citations ?? []).length > 0 ? (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed " + QUIET.border }}>
                      {(m.citations ?? []).map((c) => (
                        <a key={c.id} href="/scholar/entries" target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 12, color: QUIET.muted, marginBottom: 2 }}>
                          📖 <span>{c.title}</span>
                          <MtStatusTag mono style={{ marginLeft: 6 }}>{c.source} · {c.score.toFixed(2)}</MtStatusTag>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {typing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
              {attemptLabel ? (
                <span style={{ fontFamily: tokens.font.mono, fontSize: 11, color: QUIET.accent }}>{attemptLabel}</span>
              ) : null}
              <div style={{ display: "inline-flex", gap: 4, padding: "12px 16px", borderRadius: "14px 14px 14px 2px", background: QUIET.bubbleBot, border: "1px solid " + QUIET.border }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: QUIET.muted, animation: `mt-bounce 1.2s ease-in-out ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {sysBar ? (
          <div role="status" style={{ margin: "0 16px 8px", padding: "8px 12px", borderRadius: tokens.radiusTokens.md, background: tokens.scale.warning[0], border: "1px solid " + tokens.scale.warning[2], color: tokens.scale.warning[7], fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden>◉</span>
            {sysBar}
            <a href="/status" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: 12, textDecoration: "underline", textUnderlineOffset: 3 }}>
              服务状态
            </a>
          </div>
        ) : null}

        <div className="pg-composer pg-chat-send" style={{ display: "flex", gap: 10, padding: "12px 16px", borderTop: "1px solid " + QUIET.border, alignItems: "center" }}>
          <Input
            placeholder="输入消息"
            variant="borderless"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPressEnter={send}
            disabled={sending}
            style={{ fontSize: 15, flex: 1 }}
          />
          <Button
            type="primary"
            loading={sending}
            onClick={send}
            disabled={sending || typing}
            style={{ background: QUIET.accent, height: 36, fontWeight: 600 }}
          >
            发 送
          </Button>
        </div>
      </section>
      <style>{`@keyframes mt-bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.5; } 40% { transform: translateY(-4px); opacity: 1; } }`}</style>
    </div>
  );
}

function VerifyBadge({ verify }: { verify: NonNullable<Message["verify"]> }) {
  const [state, setState] = useState<VerifyResult>({ status: verify.status });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!verify.taskId || state.status !== "pending") return;
    let stopped = false;
    const timer = setInterval(async () => {
      if (stopped) return;
      try {
        const r = await api.getVerify(verify.taskId!);
        if (!stopped) setState(r);
      } catch {
        if (!stopped) setState((s) => ({ ...s, status: "agent_timeout" }));
      }
    }, VERIFY_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [verify.taskId, state.status]);

  const label = VERIFY_LABEL[state.status] ?? state.status;
  const diffSuffix =
    state.status === "divergent" && state.verdict?.diffPct !== undefined ? `（差 ${state.verdict.diffPct}%）` : "";
  return (
    <div style={{ marginTop: 4 }}>
      <MtStatusTag
        tone={VERIFY_TONE[state.status] ?? "neutral"}
        showDot={state.status === "pending"}
        onClick={state.status === "divergent" ? () => setExpanded((v) => !v) : undefined}
      >
        {label}
        {diffSuffix}
      </MtStatusTag>
      {expanded && state.status === "divergent" && state.agentReply ? (
        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75, whiteSpace: "pre-wrap" }}>
          智能体原文：{state.agentReply}
          {state.verdict?.agentNumbers?.length ? `（智能体数值：${state.verdict.agentNumbers.join("、")}）` : ""}
        </div>
      ) : null}
    </div>
  );
}
