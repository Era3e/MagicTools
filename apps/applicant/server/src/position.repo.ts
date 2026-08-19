import { pool } from "./db";

export const POSITION_STATUSES = ["waiting", "applied", "written", "interview", "offer", "rejected"] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

export interface PositionInput {
  company: string;
  title: string;
  city?: string;
  salary?: string;
  source?: string;
  jdRaw?: string;
  jdStructured?: Record<string, unknown>;
  status?: PositionStatus;
  appliedUrl?: string;
  notes?: string;
}

export interface PositionRow {
  id: string;
  company: string;
  title: string;
  city: string;
  salary: string;
  source: string;
  jdRaw: string;
  jdStructured: Record<string, unknown>;
  status: PositionStatus;
  appliedUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): PositionRow {
  return {
    id: r.id as string,
    company: r.company as string,
    title: r.title as string,
    city: r.city as string,
    salary: r.salary as string,
    source: r.source as string,
    jdRaw: r.jd_raw as string,
    jdStructured: (r.jd_structured as Record<string, unknown>) ?? {},
    status: r.status as PositionStatus,
    appliedUrl: r.applied_url as string,
    notes: r.notes as string,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listPositions(status?: string): Promise<PositionRow[]> {
  const rows = status
    ? await pool.query("SELECT * FROM positions WHERE status = $1 ORDER BY updated_at DESC", [status])
    : await pool.query("SELECT * FROM positions ORDER BY updated_at DESC");
  return rows.rows.map(mapRow);
}

export async function getPosition(id: string): Promise<PositionRow | null> {
  const rows = await pool.query("SELECT * FROM positions WHERE id = $1", [id]);
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}

export async function createPosition(input: PositionInput): Promise<PositionRow> {
  const rows = await pool.query(
    "INSERT INTO positions (company, title, city, salary, source, jd_raw, jd_structured, status, applied_url, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
    [input.company, input.title, input.city ?? "", input.salary ?? "", input.source ?? "manual", input.jdRaw ?? "", JSON.stringify(input.jdStructured ?? {}), input.status ?? "waiting", input.appliedUrl ?? "", input.notes ?? ""]
  );
  return mapRow(rows.rows[0]);
}

export async function updatePosition(id: string, patch: Partial<PositionInput>): Promise<PositionRow | null> {
  const current = await getPosition(id);
  if (!current) return null;
  const next = { ...current, ...patch };
  const rows = await pool.query(
    "UPDATE positions SET company=$1,title=$2,city=$3,salary=$4,source=$5,jd_raw=$6,jd_structured=$7,status=$8,applied_url=$9,notes=$10,updated_at=now() WHERE id=$11 RETURNING *",
    [next.company, next.title, next.city, next.salary, next.source, next.jdRaw, JSON.stringify(next.jdStructured), next.status, next.appliedUrl, next.notes, id]
  );
  return rows.rowCount ? mapRow(rows.rows[0]) : null;
}
