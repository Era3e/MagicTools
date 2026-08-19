import { pool } from "./db";

export type RequestStatus = "pending" | "draft" | "review" | "approved" | "rejected";

export interface AnalysisRequestRow {
  id: string;
  surveyName: string;
  sourceEventIds: string[];
  status: RequestStatus;
  contextText: string;
  repoUrl: string;
  repoContext: Record<string, unknown> | null;
  analysisMd: string | null;
  designMd: string | null;
  reviewComment: string;
  pushedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): AnalysisRequestRow {
  return {
    id: r.id as string,
    surveyName: r.survey_name as string,
    sourceEventIds: (r.source_event_ids as string[]) ?? [],
    status: r.status as RequestStatus,
    contextText: r.context_text as string,
    repoUrl: r.repo_url as string,
    repoContext: (r.repo_context as Record<string, unknown>) ?? null,
    analysisMd: (r.analysis_md as string) ?? null,
    designMd: (r.design_md as string) ?? null,
    reviewComment: r.review_comment as string,
    pushedAt: r.pushed_at ? new Date(r.pushed_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listRequests(status?: string): Promise<AnalysisRequestRow[]> {
  const rows = status
    ? await pool.query("SELECT * FROM analysis_requests WHERE status = $1 ORDER BY updated_at DESC", [status])
    : await pool.query("SELECT * FROM analysis_requests ORDER BY updated_at DESC");
  return rows.rows.map(mapRow);
}

export async function getRequest(id: string): Promise<AnalysisRequestRow | null> {
  const rows = await pool.query("SELECT * FROM analysis_requests WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function findRequestByEventIds(eventIds: string[]): Promise<AnalysisRequestRow | null> {
  const rows = await pool.query("SELECT * FROM analysis_requests WHERE source_event_ids @> $1::jsonb LIMIT 1", [JSON.stringify(eventIds)]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function createRequestWithItems(input: {
  surveyName: string;
  sourceEventIds: string[];
  items: Array<{ responseId: string; structured: Record<string, unknown>; sentiment: string; priority: string }>;
}): Promise<AnalysisRequestRow> {
  const rows = await pool.query(
    "INSERT INTO analysis_requests (survey_name, source_event_ids) VALUES ($1, $2) RETURNING *",
    [input.surveyName, JSON.stringify(input.sourceEventIds)]
  );
  const row = mapRow(rows.rows[0]);
  for (const item of input.items) {
    await pool.query(
      "INSERT INTO analysis_items (request_id, response_id, structured, sentiment, priority) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (request_id, response_id) DO NOTHING",
      [row.id, item.responseId, JSON.stringify(item.structured), item.sentiment, item.priority]
    );
  }
  return row;
}

export async function listRequestItems(requestId: string): Promise<Array<{ responseId: string; structured: Record<string, unknown>; sentiment: string; priority: string }>> {
  const rows = await pool.query("SELECT * FROM analysis_items WHERE request_id = $1 ORDER BY created_at ASC", [requestId]);
  return rows.rows.map((r) => ({
    responseId: r.response_id as string,
    structured: (r.structured as Record<string, unknown>) ?? {},
    sentiment: r.sentiment as string,
    priority: r.priority as string,
  }));
}

export async function updateRequestContext(
  id: string,
  patch: { contextText: string; repoUrl: string; repoContext: Record<string, unknown> | null }
): Promise<AnalysisRequestRow | null> {
  const rows = await pool.query(
    "UPDATE analysis_requests SET context_text = $2, repo_url = $3, repo_context = $4, updated_at = now() WHERE id = $1 RETURNING *",
    [id, patch.contextText, patch.repoUrl, patch.repoContext ? JSON.stringify(patch.repoContext) : null]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function setDocuments(id: string, patch: { analysisMd: string; designMd: string; status: string }): Promise<AnalysisRequestRow | null> {
  const rows = await pool.query(
    "UPDATE analysis_requests SET analysis_md = $2, design_md = $3, status = $4, updated_at = now() WHERE id = $1 RETURNING *",
    [id, patch.analysisMd, patch.designMd, patch.status]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function setReview(id: string, patch: { status: string; reviewComment: string }): Promise<AnalysisRequestRow | null> {
  const rows = await pool.query(
    "UPDATE analysis_requests SET status = $2, review_comment = $3, updated_at = now() WHERE id = $1 RETURNING *",
    [id, patch.status, patch.reviewComment]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function markPushed(id: string): Promise<void> {
  await pool.query("UPDATE analysis_requests SET pushed_at = now(), updated_at = now() WHERE id = $1", [id]);
}
