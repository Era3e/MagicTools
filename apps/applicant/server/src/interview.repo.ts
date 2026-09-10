import { pool } from "./db";

export interface InterviewRow {
  id: string;
  positionId: string;
  round: number;
  happenedAt: string;
  qaNotes: string;
  reflection: string;
  analysis: Record<string, unknown> | null;
  status: "scheduled" | "done";
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
    status: (r.status as "scheduled" | "done") ?? "done",
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listInterviews(positionId: string): Promise<InterviewRow[]> {
  const rows = await pool.query("SELECT * FROM interviews WHERE position_id = $1 ORDER BY round ASC", [positionId]);
  return rows.rows.map(mapRow);
}

export async function createInterview(
  positionId: string,
  input: { round: number; happenedAt?: string; qaNotes: string; reflection: string; status?: "scheduled" | "done" }
): Promise<InterviewRow> {
  const rows = await pool.query(
    "INSERT INTO interviews (position_id, round, happened_at, qa_notes, reflection, status) VALUES ($1,$2,COALESCE($3, now()),$4,$5,$6) RETURNING *",
    [positionId, input.round, input.happenedAt ?? null, input.qaNotes, input.reflection, input.status ?? "done"]
  );
  return mapRow(rows.rows[0]);
}

export interface InterviewWithPosition extends InterviewRow {
  company: string;
  title: string;
  positionStatus: string;
}

export async function listAllWithPosition(): Promise<InterviewWithPosition[]> {
  const rows = await pool.query(
    `SELECT i.*, p.company, p.title, p.status AS position_status
     FROM interviews i JOIN positions p ON p.id = i.position_id
     ORDER BY i.happened_at DESC`
  );
  return rows.rows.map((r: Record<string, unknown>) => ({
    ...mapRow(r),
    company: r.company as string,
    title: r.title as string,
    positionStatus: r.position_status as string,
  }));
}

export async function updateInterview(
  id: string,
  patch: { happenedAt?: string; status?: "scheduled" | "done" }
): Promise<InterviewRow | null> {
  const current = await getInterview(id);
  if (!current) return null;
  const happenedAt = patch.happenedAt ?? current.happenedAt;
  const status = patch.status ?? current.status;
  const rows = await pool.query(
    "UPDATE interviews SET happened_at=$2, status=$3 WHERE id=$1 RETURNING *",
    [id, happenedAt, status]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function setAnalysis(id: string, analysis: Record<string, unknown>): Promise<InterviewRow | null> {
  const rows = await pool.query("UPDATE interviews SET analysis = $2 WHERE id = $1 RETURNING *", [id, JSON.stringify(analysis)]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function getInterview(id: string): Promise<InterviewRow | null> {
  const rows = await pool.query("SELECT * FROM interviews WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}
