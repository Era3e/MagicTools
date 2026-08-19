import { pool } from "./db";

export interface IterationRow {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(r: Record<string, unknown>): IterationRow {
  return {
    id: r.id as string,
    name: r.name as string,
    startDate: r.start_date ? String(r.start_date).slice(0, 10) : null,
    endDate: r.end_date ? String(r.end_date).slice(0, 10) : null,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listIterations(): Promise<IterationRow[]> {
  const rows = await pool.query("SELECT * FROM iterations ORDER BY start_date DESC NULLS LAST, created_at DESC");
  return rows.rows.map(mapRow);
}

export async function createIteration(input: { name: string; startDate?: string | null; endDate?: string | null }): Promise<IterationRow> {
  const rows = await pool.query(
    "INSERT INTO iterations (name, start_date, end_date) VALUES ($1,$2,$3) RETURNING *",
    [input.name, input.startDate || null, input.endDate || null]
  );
  return mapRow(rows.rows[0]);
}
