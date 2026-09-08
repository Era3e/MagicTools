import { pool } from "./db";

export interface CybercloudCallRow {
  id: string;
  route: string;
  endpoint: string;
  ok: boolean;
  latencyMs: number;
  error: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface InsertCallInput {
  route: "agent" | "direct";
  endpoint: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  detail?: Record<string, unknown>;
}

function mapRow(r: Record<string, unknown>): CybercloudCallRow {
  return {
    id: r.id as string,
    route: r.route as string,
    endpoint: r.endpoint as string,
    ok: Boolean(r.ok),
    latencyMs: Number(r.latency_ms),
    error: (r.error as string | null) ?? null,
    detail: (r.detail as Record<string, unknown>) ?? {},
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function insertCybercloudCall(input: InsertCallInput): Promise<CybercloudCallRow> {
  const rows = await pool.query(
    "INSERT INTO cybercloud_calls (route, endpoint, ok, latency_ms, error, detail) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, route, endpoint, ok, latency_ms, error, detail, created_at",
    [input.route, input.endpoint, input.ok, input.latencyMs, input.error ?? null, JSON.stringify(input.detail ?? {})]
  );
  return mapRow(rows.rows[0]);
}

export async function markVerifyStatus(id: string, verifyStatus: string, diffPct?: number): Promise<void> {
  await pool.query(
    "UPDATE cybercloud_calls SET detail = detail || $2::jsonb WHERE id = $1",
    [id, JSON.stringify({ verify_status: verifyStatus, ...(diffPct !== undefined ? { diff_pct: diffPct } : {}) })]
  );
}

export async function listCybercloudCalls(limit = 200): Promise<CybercloudCallRow[]> {
  const rows = await pool.query(
    "SELECT id, route, endpoint, ok, latency_ms, error, detail, created_at FROM cybercloud_calls ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return rows.rows.map(mapRow);
}
