import { pool } from "./db";

export interface InterviewRow {
  id: string;
  positionId: string;
  round: number;
  happenedAt: string;
  qaNotes: string;
  reflection: string;
  analysis: Record<string, unknown> | null;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): InterviewRow {
  return {
    id: r.id as string,
    positionId: r.position_id as string,
    round: r.round as number,
    happenedAt: new Date(r.happened_at as string).toISOString(),
    qaNotes: r.qa_notes as string,
    reflection: r.reflection as string,
    analysis: (r.analysis as Record<string, unknown>) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listInterviews(positionId: string): Promise<InterviewRow[]> {
  const rows = await pool.query("SELECT * FROM interviews WHERE position_id = $1 ORDER BY round ASC", [positionId]);
  return rows.rows.map(mapRow);
}

export async function createInterview(positionId: string, input: { round: number; qaNotes: string; reflection: string }): Promise<InterviewRow> {
  const rows = await pool.query(
    "INSERT INTO interviews (position_id, round, qa_notes, reflection) VALUES ($1,$2,$3,$4) RETURNING *",
    [positionId, input.round, input.qaNotes, input.reflection]
  );
  return mapRow(rows.rows[0]);
}

export async function setAnalysis(id: string, analysis: Record<string, unknown>): Promise<InterviewRow | null> {
  const rows = await pool.query("UPDATE interviews SET analysis = $2 WHERE id = $1 RETURNING *", [id, JSON.stringify(analysis)]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function getInterview(id: string): Promise<InterviewRow | null> {
  const rows = await pool.query("SELECT * FROM interviews WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}
