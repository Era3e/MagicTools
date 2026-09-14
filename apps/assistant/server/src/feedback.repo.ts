import { pool } from "./db";

export interface FeedbackRow {
  id: string;
  content: string;
  contact: string;
  conversationId: string | null;
  userMessageId: string | null;
  intentLogId: string | null;
  traceId: string | null;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): FeedbackRow {
  return {
    id: r.id as string,
    content: r.content as string,
    contact: r.contact as string,
    conversationId: (r.conversation_id as string | null) ?? null,
    userMessageId: (r.user_message_id as string | null) ?? null,
    intentLogId: (r.intent_log_id as string | null) ?? null,
    traceId: (r.trace_id as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export interface FeedbackContext {
  conversationId?: string;
  userMessageId?: string;
  intentLogId?: string;
  traceId?: string;
}

export async function insertFeedback(content: string, contact = "", context: FeedbackContext = {}): Promise<FeedbackRow> {
  const rows = await pool.query(
    `INSERT INTO feedback (content, contact, conversation_id, user_message_id, intent_log_id, trace_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [content, contact, context.conversationId ?? null, context.userMessageId ?? null, context.intentLogId ?? null, context.traceId ?? null]
  );
  return mapRow(rows.rows[0]);
}

export async function listFeedback(limit = 100): Promise<FeedbackRow[]> {
  const rows = await pool.query("SELECT * FROM feedback ORDER BY created_at DESC LIMIT $1", [limit]);
  return rows.rows.map(mapRow);
}

export async function getFeedback(id: string): Promise<FeedbackRow | null> {
  const rows = await pool.query("SELECT * FROM feedback WHERE id = $1", [id]);
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function deleteFeedback(id: string): Promise<boolean> {
  const rows = await pool.query("DELETE FROM feedback WHERE id = $1", [id]);
  return (rows.rowCount ?? 0) > 0;
}
