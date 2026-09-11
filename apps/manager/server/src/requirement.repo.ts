import { pool } from "./db";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { canTransition } from "./requirement-policy";
import type { PoolClient } from "pg";
import { getApprovalReadiness, type RequirementRisk } from "./requirement-content";

export const REQUIREMENT_STATUSES = ["waiting", "designing", "todo", "developing", "testing", "accepting", "done"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];
export const REQUIREMENT_SOURCES = ["assessor", "manual", "github", "cybercloud"] as const;

export interface RequirementRow {
  id: string;
  revision: number;
  contentRevision: number;
  approvedContentRevision: number | null;
  approvalStatus: "unapproved" | "approved" | "outdated";
  approvalReadiness: { ready: boolean; missing: string[] };
  scope: string;
  risk: RequirementRisk;
  project: string;
  acceptanceCriteria: string[];
  evidenceRefs: Array<Record<string, unknown>>;
  dependencyRefs: string[];
  automationPolicy: "manual";
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

export type RequirementMutation = RequirementRow & { transitionApplied?: boolean };

export function mapRow(r: Record<string, unknown>): RequirementRow {
  const contentRevision = Number(r.content_revision ?? 1);
  const approvedContentRevision = r.approved_content_revision == null ? null : Number(r.approved_content_revision);
  const row: Omit<RequirementRow, "approvalReadiness"> = {
    id: r.id as string,
    revision: Number(r.revision),
    contentRevision,
    approvedContentRevision,
    approvalStatus: approvedContentRevision === contentRevision ? "approved" : approvedContentRevision == null ? "unapproved" : "outdated",
    scope: (r.scope as string) ?? "",
    risk: (r.risk as RequirementRisk) ?? "unassessed",
    project: (r.project as string) ?? "",
    acceptanceCriteria: (r.acceptance_criteria as string[]) ?? [],
    evidenceRefs: (r.evidence_refs as Array<Record<string, unknown>>) ?? [],
    dependencyRefs: (r.dependency_refs as string[]) ?? [],
    automationPolicy: "manual",
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
  return { ...row, approvalReadiness: getApprovalReadiness(row) };
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
  project?: string;
  acceptanceCriteria?: string[];
  evidenceRefs?: Array<Record<string, unknown>>;
  dependencyRefs?: string[];
  scope?: string;
  risk?: RequirementRisk;
}, database: Pick<PoolClient, "query"> = pool): Promise<RequirementRow> {
  const rows = await database.query(
    "INSERT INTO requirements (title, description, source, source_ref, source_payload, priority, branch, pr_url, labels, iteration_id, project, acceptance_criteria, evidence_refs, dependency_refs, scope, risk) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *",
    [input.title, input.description ?? "", input.source ?? "manual", input.sourceRef ?? "", input.sourcePayload ? JSON.stringify(input.sourcePayload) : null, input.priority ?? "P2", input.branch ?? "", input.prUrl ?? "", JSON.stringify(input.labels ?? []), input.iterationId ?? null, input.project ?? "", JSON.stringify(input.acceptanceCriteria ?? []), JSON.stringify(input.evidenceRefs ?? []), JSON.stringify(input.dependencyRefs ?? []), input.scope ?? "", input.risk ?? "unassessed"]
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
  status: RequirementStatus;
  project: string;
  scope: string;
  risk: RequirementRisk;
  acceptanceCriteria: string[];
  dependencyRefs: string[];
}>, options: { note?: string; origin?: "manual" | "github"; expectedRevision?: number } = {}): Promise<RequirementMutation | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query("SELECT * FROM requirements WHERE id=$1 FOR UPDATE", [id]);
    if (!locked.rowCount) {
      await client.query("COMMIT");
      return null;
    }
    const current = mapRow(locked.rows[0]);
    if (options.expectedRevision !== undefined && options.expectedRevision !== current.revision) {
      throw new ConflictException({ message: "需求已被其他操作更新，请刷新后重试", currentRevision: current.revision });
    }
    const next = { ...current, ...patch };
    if (options.origin === "github" && next.status === current.status) {
      await client.query("COMMIT");
      return { ...current, transitionApplied: false };
    }
    if (!canTransition(current.status, next.status, options.origin)) {
      if (options.origin === "github") {
        await client.query("COMMIT");
        return { ...current, transitionApplied: false };
      }
      throw new BadRequestException(`不允许从 ${current.status} 迁移到 ${next.status}`);
    }
    const timeline = next.status === current.status ? current.timeline : [
      ...current.timeline,
      { at: new Date().toISOString(), from: current.status, to: next.status, ...(options.note ? { note: options.note } : {}) },
    ];
    const rows = await client.query(
      "UPDATE requirements SET title=$1, description=$2, priority=$3, branch=$4, pr_url=$5, iteration_id=$6, status=$7, timeline=$8, project=$9, scope=$10, risk=$11, acceptance_criteria=$12, dependency_refs=$13, revision=revision+1, updated_at=now() WHERE id=$14 RETURNING *",
      [next.title, next.description, next.priority, next.branch, next.prUrl, next.iterationId, next.status, JSON.stringify(timeline), next.project, next.scope, next.risk, JSON.stringify(next.acceptanceCriteria), JSON.stringify(next.dependencyRefs), id]
    );
    await client.query("COMMIT");
    return { ...mapRow(rows.rows[0]), ...(options.origin === "github" ? { transitionApplied: true } : {}) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setStatusWithTimeline(id: string, status: RequirementStatus, from: RequirementStatus, note?: string): Promise<RequirementMutation | null> {
  // 时间线必须使用行锁内读取的实际状态，不使用调用方的旧快照。
  void from;
  return updateRequirement(id, { status }, { note, origin: "github" });
}
