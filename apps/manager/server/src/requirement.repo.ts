import { pool } from "./db";

export const REQUIREMENT_STATUSES = ["waiting", "designing", "todo", "developing", "testing", "accepting", "done"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];
export const REQUIREMENT_SOURCES = ["assessor", "manual", "github", "cybercloud"] as const;

export interface RequirementRow {
  id: string;
  title: string;
  description: string;
  source: string;
  sourceRef: string;
  sourcePayload: Record<string, unknown> | null;
  status: RequirementStatus;
  priority: string;
  iterationId: string | null;
  branch: string;
  prUrl: string;
  labels: string[];
  timeline: Array<{ at: string; from: string; to: string; note?: string }>;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): RequirementRow {
  return {
    id: r.id as string,
    title: r.title as string,
    description: r.description as string,
    source: r.source as string,
    sourceRef: r.source_ref as string,
    sourcePayload: (r.source_payload as Record<string, unknown>) ?? null,
    status: r.status as RequirementStatus,
    priority: r.priority as string,
    iterationId: (r.iteration_id as string) ?? null,
    branch: r.branch as string,
    prUrl: r.pr_url as string,
    labels: (r.labels as string[]) ?? [],
    timeline: (r.timeline as Array<{ at: string; from: string; to: string; note?: string }>) ?? [],
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listRequirements(filters: { status?: string; source?: string; iterationId?: string } = {}): Promise<RequirementRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.status) { params.push(filters.status); where.push("status = $" + params.length); }
  if (filters.source) { params.push(filters.source); where.push("source = $" + params.length); }
  if (filters.iterationId) { params.push(filters.iterationId); where.push("iteration_id = $" + params.length); }
  const rows = await pool.query(
    "SELECT * FROM requirements" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY updated_at DESC",
    params
  );
  return rows.rows.map(mapRow);
}

export async function getRequirement(id: string): Promise<RequirementRow | null> {
  const rows = await pool.query("SELECT * FROM requirements WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function findRequirementByEventId(eventId: string): Promise<RequirementRow | null> {
  const rows = await pool.query("SELECT * FROM requirements WHERE source_ref = $1 AND source = 'assessor' LIMIT 1", [eventId]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function findRequirementByRef(source: string, ref: string): Promise<RequirementRow | null> {
  const rows = await pool.query("SELECT * FROM requirements WHERE source = $1 AND source_ref = $2 LIMIT 1", [source, ref]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function createRequirement(input: {
  title: string;
  description?: string;
  source?: string;
  sourceRef?: string;
  sourcePayload?: Record<string, unknown> | null;
  priority?: string;
  branch?: string;
  prUrl?: string;
  labels?: string[];
  iterationId?: string | null;
}): Promise<RequirementRow> {
  const rows = await pool.query(
    "INSERT INTO requirements (title, description, source, source_ref, source_payload, priority, branch, pr_url, labels, iteration_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
    [input.title, input.description ?? "", input.source ?? "manual", input.sourceRef ?? "", input.sourcePayload ? JSON.stringify(input.sourcePayload) : null, input.priority ?? "P2", input.branch ?? "", input.prUrl ?? "", JSON.stringify(input.labels ?? []), input.iterationId ?? null]
  );
  return mapRow(rows.rows[0]);
}

export async function updateRequirement(id: string, patch: Partial<{
  title: string;
  description: string;
  priority: string;
  branch: string;
  prUrl: string;
  iterationId: string | null;
}>): Promise<RequirementRow | null> {
  const current = await getRequirement(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  const rows = await pool.query(
    "UPDATE requirements SET title=$1, description=$2, priority=$3, branch=$4, pr_url=$5, iteration_id=$6, updated_at=now() WHERE id=$7 RETURNING *",
    [next.title, next.description, next.priority, next.branch, next.prUrl, next.iterationId, id]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function setStatusWithTimeline(id: string, status: RequirementStatus, from: RequirementStatus, note?: string): Promise<RequirementRow | null> {
  const current = await getRequirement(id);
  if (!current) return null;
  const timeline = [...current.timeline, { at: new Date().toISOString(), from: from, to: status, ...(note ? { note } : {}) }];
  const rows = await pool.query(
    "UPDATE requirements SET status=$2, timeline=$3, updated_at=now() WHERE id=$1 RETURNING *",
    [id, status, JSON.stringify(timeline)]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}
