import { pool } from "./db";

export interface GenerationRow {
  id: string;
  prompt: string;
  imageUrl: string;
  componentName: string;
  description: string;
  code: string;
  status: "ok" | "failed";
  error: string | null;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): GenerationRow {
  return {
    id: r.id as string,
    prompt: r.prompt as string,
    imageUrl: r.image_url as string,
    componentName: r.component_name as string,
    description: r.description as string,
    code: r.code as string,
    status: r.status as GenerationRow["status"],
    error: (r.error as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function createGeneration(input: {
  prompt: string;
  imageUrl: string;
  componentName: string;
  description: string;
  code: string;
  status: "ok" | "failed";
  error?: string;
}): Promise<GenerationRow> {
  const rows = await pool.query(
    "INSERT INTO generations (prompt, image_url, component_name, description, code, status, error) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, prompt, image_url, component_name, description, code, status, error, created_at",
    [input.prompt, input.imageUrl, input.componentName, input.description, input.code, input.status, input.error ?? null]
  );
  return mapRow(rows.rows[0]);
}

export async function listGenerations(limit = 50): Promise<GenerationRow[]> {
  const rows = await pool.query(
    "SELECT id, prompt, image_url, component_name, description, code, status, error, created_at FROM generations ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return rows.rows.map(mapRow);
}
