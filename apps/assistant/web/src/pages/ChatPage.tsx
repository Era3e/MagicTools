import { useEffect, useRef, useState } from "react";
import { Button, Input, Tag, message } from "antd";
import { api, type Conversation, type Message } from "../api";
import { useTheme } from "@mt/ui";

const INTENT_LABEL: Record<string, string> = {
  product_inquiry: "知识问答",
  data_query: "数据查询",
  chitchat_reject: "闲聊",
  process_execution: "流程执行",
  trouble_shooting: "故障排查",
  complaint_feedback: "反馈",
};

export default function ChatPage() {
  const theme = useTheme();
  const QUIET = {
    ink: theme.ink,
    accent: theme.accent ?? theme.primary,
    muted: theme.muted,
    bubbleUser: theme.bubbleUser ?? theme.background,
    bubbleBot: theme.bubbleBot ?? theme.background,
    border: theme.border ?? theme.muted,
    sans: theme.bodyFont,
  };
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const refreshConversations = () =>
    api.listConversations().then(setConversations).catch((err) => message.error(String(err)));

  useEffect(() => {
    refreshConversations();
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const open = async (id: string) => {
    setActiveId(id);
    setMessages(await api.getMessages(id).catch((err) => {
      message.error(String(err));
      return [] as Message[];
    }));
  };

  const sendText = async (text: string) => {
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await api.chat({ sessionId: activeId ?? undefined, message: text });
      setActiveId(res.sessionId);
      setMessages((prev) => [
        ...prev,
        { id: "local-u" + Date.now(), conversationId: res.sessionId, role: "user", content: text, intent: "", citations: [], createdAt: new Date().toISOString() },
        { id: "local-a" + Date.now(), conversationId: res.sessionId, role: "assistant", content: res.reply, intent: res.intent, citations: res.citations, actionResult: res.actionResult, clarifying: res.clarifying, clarifyOptions: res.clarifyOptions, createdAt: new Date().toISOString() },
      ]);
      refreshConversations();
    } catch (err) {
      message.error(String(err));
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

  return (
    <div style={{ display: "flex", gap: 0, height: "calc(100vh - 300px)", minHeight: 420, fontFamily: QUIET.sans }}>
      <aside
        style={{
          width: 220,
          borderRight: "1px solid " + QUIET.border,
          paddingRight: 12,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Button
          block
          onClick={() => { setActiveId(null); setMessages([]); }}
          style={{
            border: "none",
            boxShadow: "none",
            fontWeight: 600,
            color: QUIET.accent,
            textAlign: "left",
            marginBottom: 8,
          }}
        >
          ＋ 新对话
        </Button>
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => open(c.id)}
            style={{
              cursor: "pointer",
              padding: "8px 10px",
              borderRadius: 4,
              background: c.id === activeId ? QUIET.bubbleUser : "transparent",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              color: c.id === activeId ? QUIET.ink : QUIET.muted,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
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
        ))}
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingLeft: 24, minWidth: 0 }}>
        <div ref={listRef} style={{ flex: 1, overflow: "auto", paddingBottom: 16 }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 80, color: QUIET.muted }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>◇</div>
              开始对话吧
              <div style={{ fontSize: 12, marginTop: 4 }}>知识问答 · 数据查询 · 故障排查</div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 20, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "72%",
                    padding: "10px 14px",
                    borderRadius: m.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                    background: m.role === "user" ? QUIET.bubbleUser : QUIET.bubbleBot,
                    border: m.role === "user" ? "none" : "1px solid " + QUIET.border,
                    whiteSpace: "pre-wrap",
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: QUIET.ink,
                  }}
                >
                  {m.content}
                  {m.role === "assistant" && m.intent ? (
                    <div style={{ marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: QUIET.accent }}>— {INTENT_LABEL[m.intent] ?? m.intent}</span>
                    </div>
                  ) : null}
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
                          <Tag style={{ marginLeft: 6, fontSize: 11 }}>{c.source} · {c.score.toFixed(2)}</Tag>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", gap: 10, paddingTop: 12, borderTop: "1px solid " + QUIET.border }}>
          <Input
            placeholder="输入消息"
            variant="borderless"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPressEnter={send}
            disabled={sending}
            style={{ fontSize: 15 }}
          />
          <Button
            type="text"
            loading={sending}
            onClick={send}
            style={{ color: QUIET.accent, fontWeight: 600, letterSpacing: 2 }}
          >
            发 送
          </Button>
        </div>
      </div>
    </div>
  );
}
