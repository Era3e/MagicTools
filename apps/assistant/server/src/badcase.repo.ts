import { pool } from "./db";

export type BadcaseSource = "user_feedback" | "user_clarify" | "admin_review" | "evaluation";
export type BadcaseStage = "routing" | "knowledge" | "action" | "data" | "safety" | "other";
export type BadcaseStatus =
  | "new" | "confirmed" | "classified" | "regression_ready" | "fix_planned"
  | "fix_merged" | "regression_passed" | "closed" | "rejected" | "duplicate";

export interface BadcaseRow {
  id: string;
  source: BadcaseSource;
  stage: BadcaseStage;
  status: BadcaseStatus;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  evidence: Record<string, unknown>;
  expected: Record<string, unknown> | null;
  traceId: string | null;
  conversationId: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
  intentLogId: string | null;
  feedbackId: string | null;
  evaluationRunId: string | null;
  evaluationRunItemId: string | null;
  evaluationCaseId: string | null;
  baselineRunId: string | null;
  verificationRunId: string | null;
  requirementId: string | null;
  requirementUrl: string;
  fixPrUrl: string;
  closedReason: string;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): BadcaseRow {
  return {
    id: row.id as string,
    source: row.source as BadcaseSource,
    stage: row.stage as BadcaseStage,
    status: row.status as BadcaseStatus,
    title: row.title as string,
    description: row.description as string,
    severity: row.severity as BadcaseRow["severity"],
    evidence: (row.evidence ?? {}) as Record<string, unknown>,
    expected: (row.expected ?? null) as Record<string, unknown> | null,
    traceId: (row.trace_id as string | null) ?? null,
    conversationId: (row.conversation_id as string | null) ?? null,
    userMessageId: (row.user_message_id as string | null) ?? null,
    assistantMessageId: (row.assistant_message_id as string | null) ?? null,
    intentLogId: (row.intent_log_id as string | null) ?? null,
    feedbackId: (row.feedback_id as string | null) ?? null,
    evaluationRunId: (row.evaluation_run_id as string | null) ?? null,
    evaluationRunItemId: (row.evaluation_run_item_id as string | null) ?? null,
    evaluationCaseId: (row.evaluation_case_id as string | null) ?? null,
    baselineRunId: (row.baseline_run_id as string | null) ?? null,
    verificationRunId: (row.verification_run_id as string | null) ?? null,
    requirementId: (row.requirement_id as string | null) ?? null,
    requirementUrl: (row.requirement_url as string) ?? "",
    fixPrUrl: (row.fix_pr_url as string) ?? "",
    closedReason: (row.closed_reason as string) ?? "",
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export async function insertBadcase(input: {
  source: BadcaseSource; stage: BadcaseStage; title: string; description?: string;
  severity?: "low" | "medium" | "high"; evidence?: Record<string, unknown>; expected?: Record<string, unknown> | null;
  traceId?: string | null; conversationId?: string | null; userMessageId?: string | null;
  assistantMessageId?: string | null; intentLogId?: string | null; feedbackId?: string | null;
  evaluationRunId?: string | null; evaluationRunItemId?: string | null;
}): Promise<BadcaseRow> {
  const rows = await pool.query(
    `INSERT INTO assistant_badcases
      (source, stage, status, title, description, severity, evidence, expected, trace_id, conversation_id,
       user_message_id, assistant_message_id, intent_log_id, feedback_id, evaluation_run_id, evaluation_run_item_id)
     VALUES ($1,$2,'new',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT DO NOTHING RETURNING *`,
    [
      input.source, input.stage, input.title, input.description ?? "", input.severity ?? "medium",
      JSON.stringify(input.evidence ?? {}), input.expected === undefined ? null : JSON.stringify(input.expected),
      input.traceId ?? null, input.conversationId ?? null, input.userMessageId ?? null, input.assistantMessageId ?? null,
      input.intentLogId ?? null, input.feedbackId ?? null, input.evaluationRunId ?? null, input.evaluationRunItemId ?? null,
    ]
  );
  if (rows.rows[0]) return mapRow(rows.rows[0]);
  const existing = await pool.query("SELECT * FROM assistant_badcases WHERE intent_log_id=$1 AND source='user_clarify'", [input.intentLogId]);
  if (!existing.rows[0]) throw new Error("badcase 写入后未返回记录");
  return mapRow(existing.rows[0]);
}

export async function listBadcases(status?: BadcaseStatus): Promise<BadcaseRow[]> {
  const rows = status
    ? await pool.query("SELECT * FROM assistant_badcases WHERE status=$1 ORDER BY updated_at DESC", [status])
    : await pool.query("SELECT * FROM assistant_badcases ORDER BY updated_at DESC");
  return rows.rows.map(mapRow);
}

export async function getBadcase(id: string): Promise<BadcaseRow | null> {
  const rows = await pool.query("SELECT * FROM assistant_badcases WHERE id=$1", [id]);
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function updateBadcase(id: string, patch: Partial<{
  status: BadcaseStatus; stage: BadcaseStage; title: string; description: string;
  severity: BadcaseRow["severity"]; expected: Record<string, unknown> | null;
  evaluationCaseId: string | null; baselineRunId: string | null; verificationRunId: string | null;
  requirementId: string | null; requirementUrl: string; fixPrUrl: string; closedReason: string;
}>): Promise<BadcaseRow | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];
  const columnMap: Record<string, string> = {
    status: "status", stage: "stage", title: "title", description: "description", severity: "severity",
    expected: "expected", evaluationCaseId: "evaluation_case_id", baselineRunId: "baseline_run_id",
    verificationRunId: "verification_run_id", requirementId: "requirement_id",
    requirementUrl: "requirement_url", fixPrUrl: "fix_pr_url", closedReason: "closed_reason",
  };
  for (const [key, column] of Object.entries(columnMap)) {
    if (!(key in patch)) continue;
    values.push((patch as Record<string, unknown>)[key]);
    assignments.push(`${column}=$${values.length}`);
  }
  if (!assignments.length) return getBadcase(id);
  values.push(id);
  const rows = await pool.query(
    `UPDATE assistant_badcases SET ${assignments.join(", ")}, updated_at=now() WHERE id=$${values.length} RETURNING *`,
    values
  );
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function insertRegressionCase(input: {
  caseKey: string; caseType: "routing" | "knowledge" | "action"; message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>; expected: Record<string, unknown>;
  sourceRef: string;
}): Promise<string> {
  const rows = await pool.query(
    `INSERT INTO evaluation_cases
      (case_key, case_type, split, message, history, expected, enabled, source_type, source_ref)
     VALUES ($1,$2,'regression',$3,$4,$5,true,'assistant_badcase',$6)
     ON CONFLICT (case_key) DO UPDATE SET updated_at=now() RETURNING id`,
    [input.caseKey, input.caseType, input.message, JSON.stringify(input.history), JSON.stringify(input.expected), input.sourceRef]
  );
  return rows.rows[0].id as string;
}
