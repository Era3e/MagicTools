import { pool } from "./db";

export interface Citation {
  id: string;
  title: string;
  source: string;
  score: number;
}

export interface ConversationRow {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRow {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  intent: string;
  citations: Citation[];
  createdAt: string;
}

function mapConversation(r: Record<string, unknown>): ConversationRow {
  return {
    id: r.id as string,
    title: r.title as string,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

function mapMessage(r: Record<string, unknown>): MessageRow {
  return {
    id: r.id as string,
    conversationId: r.conversation_id as string,
    role: r.role as MessageRow["role"],
    content: r.content as string,
    intent: r.intent as string,
    citations: (r.citations as Citation[]) ?? [],
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function createConversation(title: string): Promise<ConversationRow> {
  const rows = await pool.query("INSERT INTO conversations (title) VALUES ($1) RETURNING id, title, created_at, updated_at", [title]);
  return mapConversation(rows.rows[0]);
}

export async function getConversation(id: string): Promise<ConversationRow | null> {
  const rows = await pool.query("SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1", [id]);
  return rows.rows[0] ? mapConversation(rows.rows[0]) : null;
}

export async function touchConversation(id: string): Promise<void> {
  await pool.query("UPDATE conversations SET updated_at = now() WHERE id = $1", [id]);
}

export async function insertMessage(input: {
  conversationId: string;
  role: MessageRow["role"];
  content: string;
  intent: string;
  citations: Citation[];
}): Promise<MessageRow> {
  const rows = await pool.query(
    "INSERT INTO messages (conversation_id, role, content, intent, citations) VALUES ($1, $2, $3, $4, $5) RETURNING id, conversation_id, role, content, intent, citations, created_at",
    [input.conversationId, input.role, input.content, input.intent, JSON.stringify(input.citations)]
  );
  return mapMessage(rows.rows[0]);
}

export async function listMessages(conversationId: string, limit = 20): Promise<MessageRow[]> {
  const rows = await pool.query(
    "SELECT id, conversation_id, role, content, intent, citations, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC, id ASC LIMIT $2",
    [conversationId, limit]
  );
  return rows.rows.map(mapMessage);
}
