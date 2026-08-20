import { pool } from "./db";

export interface FeedbackRow {
  id: string;
  content: string;
  contact: string;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): FeedbackRow {
  return {
    id: r.id as string,
    content: r.content as string,
    contact: r.contact as string,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function insertFeedback(content: string, contact = ""): Promise<FeedbackRow> {
  const rows = await pool.query(
    "INSERT INTO feedback (content, contact) VALUES ($1, $2) RETURNING id, content, contact, created_at",
    [content, contact]
  );
  return mapRow(rows.rows[0]);
}

export async function listFeedback(limit = 100): Promise<FeedbackRow[]> {
  const rows = await pool.query("SELECT id, content, contact, created_at FROM feedback ORDER BY created_at DESC LIMIT $1", [limit]);
  return rows.rows.map(mapRow);
}

export async function deleteFeedback(id: string): Promise<boolean> {
  const rows = await pool.query("DELETE FROM feedback WHERE id = $1", [id]);
  return (rows.rowCount ?? 0) > 0;
}
