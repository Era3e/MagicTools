import { useEffect, useRef, useState } from "react";
import { Button, Card, Input, List, Space, Tag, Typography, message } from "antd";
import { api, type Conversation, type Message } from "../api";
import { tokens, MtEmptyState } from "@mt/ui";

const INTENT_LABEL: Record<string, { label: string; color: string }> = {
  product_inquiry: { label: "知识问答", color: "blue" },
  data_query: { label: "数据查询", color: "green" },
  chitchat_reject: { label: "闲聊", color: "default" },
  process_execution: { label: "流程执行", color: "purple" },
  trouble_shooting: { label: "故障排查", color: "orange" },
  complaint_feedback: { label: "反馈", color: "cyan" },
};

export default function ChatPage() {
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
    <Card title="智能助手" style={{ height: "calc(100vh - 48px)" }}>
      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 160px)" }}>
        <div style={{ width: 240, borderRight: "1px solid " + tokens.color.border, paddingRight: 8, overflow: "auto" }}>
          <Button block type="primary" style={{ marginBottom: 12 }} onClick={() => { setActiveId(null); setMessages([]); }}>
            新对话
          </Button>
          <List<Conversation>
            dataSource={conversations}
            renderItem={(c) => (
              <List.Item
                style={{ cursor: "pointer", background: c.id === activeId ? tokens.color.bgActive : undefined }}
                onClick={() => open(c.id)}
                actions={[
                  <Button key="del" size="small" type="text" onClick={(e) => { e.stopPropagation(); remove(c.id); }}>
                    删除
                  </Button>,
                ]}
              >
                <Typography.Text ellipsis>{c.title || "未命名会话"}</Typography.Text>
              </List.Item>
            )}
          />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div ref={listRef} style={{ flex: 1, overflow: "auto", paddingBottom: 12 }}>
            {messages.length === 0 ? (
              <MtEmptyState title="开始对话吧" />
            ) : (
              messages.map((m) => (
                <div key={m.id} style={{ marginBottom: 16, textAlign: m.role === "user" ? "right" : "left" }}>
                  <div
                    style={{
                      display: "inline-block",
                      maxWidth: "75%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: m.role === "user" ? tokens.color.bgUser : tokens.color.bgNeutral,
                      whiteSpace: "pre-wrap",
                      textAlign: "left",
                    }}
                  >
                    <Typography.Paragraph style={{ marginBottom: 4 }}>{m.content}</Typography.Paragraph>
                    {m.role === "assistant" && m.intent ? (
                      <Tag color={INTENT_LABEL[m.intent]?.color}>{INTENT_LABEL[m.intent]?.label ?? m.intent}</Tag>
                    ) : null}
                    {m.role === "assistant" && m.actionResult?.ok ? (
                      <Tag color="green">动作已执行：{String(m.actionResult.action ?? "")}</Tag>
                    ) : null}
                    {m.role === "assistant" && m.clarifying && m.clarifyOptions ? (
                      <Space direction="vertical" size={4} style={{ marginTop: 6 }}>
                        {m.clarifyOptions.map((o) => (
                          <Button key={o.intent} size="small" onClick={() => sendText(o.intent)}>
                            {o.label}
                          </Button>
                        ))}
                      </Space>
                    ) : null}
                    {(m.citations ?? []).length > 0 ? (
                      <Space direction="vertical" size={2} style={{ marginTop: 6 }}>
                        {(m.citations ?? []).map((c) => (
                          <a key={c.id} href="/scholar/entries" target="_blank" rel="noreferrer">
                            📖 <span>{c.title}</span>
                            <Tag style={{ marginLeft: 6 }}>{c.source}</Tag>
                            <Tag color="blue">相似度 {c.score.toFixed(2)}</Tag>
                          </a>
                        ))}
                      </Space>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              placeholder="输入消息"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPressEnter={send}
              disabled={sending}
            />
            <Button type="primary" loading={sending} onClick={send}>
              发送
            </Button>
          </Space.Compact>
        </div>
      </div>
    </Card>
  );
}