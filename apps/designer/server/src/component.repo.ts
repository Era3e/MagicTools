import { pool } from "./db";

export interface ComponentRow {
  id: string;
  name: string;
  description: string;
  code: string;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): ComponentRow {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    code: r.code as string,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

const COLUMNS = "id, name, description, code, created_at";

export async function insertComponent(name: string, description: string, code: string): Promise<ComponentRow | null> {
  const rows = await pool.query(
    "INSERT INTO components (name, description, code) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING RETURNING " + COLUMNS,
    [name, description, code]
  );
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function findComponentByName(name: string): Promise<ComponentRow | null> {
  const rows = await pool.query("SELECT " + COLUMNS + " FROM components WHERE name = $1", [name]);
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function listComponents(): Promise<ComponentRow[]> {
  const rows = await pool.query("SELECT " + COLUMNS + " FROM components ORDER BY created_at DESC LIMIT 200");
  return rows.rows.map(mapRow);
}

export async function getComponent(id: string): Promise<ComponentRow | null> {
  const rows = await pool.query("SELECT " + COLUMNS + " FROM components WHERE id = $1", [id]);
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function deleteComponent(id: string): Promise<boolean> {
  const rows = await pool.query("DELETE FROM components WHERE id = $1", [id]);
  return (rows.rowCount ?? 0) > 0;
}
