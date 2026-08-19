import { pool } from "./db";

export interface ResumeRow {
  id: string;
  name: string;
  version: number;
  source: string;
  contentText: string;
  clawcvSessionId: string | null;
  lastAnalysis: Record<string, unknown> | null;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): ResumeRow {
  return {
    id: r.id as string,
    name: r.name as string,
    version: r.version as number,
    source: r.source as string,
    contentText: r.content_text as string,
    clawcvSessionId: (r.clawcv_session_id as string) ?? null,
    lastAnalysis: (r.last_analysis as Record<string, unknown>) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listResumes(): Promise<ResumeRow[]> {
  const rows = await pool.query("SELECT * FROM resumes ORDER BY created_at DESC");
  return rows.rows.map(mapRow);
}

export async function getResume(id: string): Promise<ResumeRow | null> {
  const rows = await pool.query("SELECT * FROM resumes WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function createResume(input: { name: string; contentText: string; source?: string }): Promise<ResumeRow> {
  const rows = await pool.query(
    "INSERT INTO resumes (name, content_text, source) VALUES ($1,$2,$3) RETURNING *",
    [input.name, input.contentText, input.source ?? "clawcv"]
  );
  return mapRow(rows.rows[0]);
}

export async function setResumeAnalysis(id: string, analysis: Record<string, unknown>): Promise<void> {
  await pool.query("UPDATE resumes SET last_analysis = $2 WHERE id = $1", [id, JSON.stringify(analysis)]);
}

export async function setResumeSession(id: string, sessionId: string): Promise<void> {
  await pool.query("UPDATE resumes SET clawcv_session_id = $2 WHERE id = $1", [id, sessionId]);
}

export async function appendRewrite(input: { resumeId: string; positionId?: string; sectionType: string; originalText: string; rewrittenText: string }): Promise<void> {
  await pool.query(
    "INSERT INTO resume_rewrites (resume_id, position_id, section_type, original_text, rewritten_text) VALUES ($1,$2,$3,$4,$5)",
    [input.resumeId, input.positionId ?? null, input.sectionType, input.originalText, input.rewrittenText]
  );
}

export async function saveMatch(input: { resumeId: string; positionId: string; matchScore: number; gaps: unknown[]; missingKeywords: string[] }): Promise<void> {
  await pool.query(
    "INSERT INTO job_matches (resume_id, position_id, match_score, gaps, missing_keywords) VALUES ($1,$2,$3,$4,$5)",
    [input.resumeId, input.positionId, input.matchScore, JSON.stringify(input.gaps), JSON.stringify(input.missingKeywords)]
  );
}
