import { pool } from "./db";

export interface EntryRow {
  id: string;
  source: "gatherer" | "manual" | "obsidian";
  sourceRef: string | null;
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  assistantScope: boolean;
  createdAt: string;
  updatedAt: string;
}

export const COLUMNS = "id, source, source_ref, title, content, summary, category, tags, assistant_scope, created_at, updated_at";

export function mapRow(r: Record<string, unknown>): EntryRow {
  return {
    id: r.id as string,
    source: r.source as EntryRow["source"],
    sourceRef: (r.source_ref as string | null) ?? null,
    title: r.title as string,
    content: r.content as string,
    summary: r.summary as string,
    category: r.category as string,
    tags: (r.tags as string[]) ?? [],
    assistantScope: Boolean(r.assistant_scope),
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listEntries(filters: { source?: string; category?: string; tag?: string } = {}): Promise<EntryRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.source) { params.push(filters.source); where.push("source = $" + params.length); }
  if (filters.category) { params.push(filters.category); where.push("category = $" + params.length); }
  if (filters.tag) { params.push(filters.tag); where.push("tags ? $" + params.length); }
  const rows = await pool.query(
    "SELECT " + COLUMNS + " FROM entries" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY created_at DESC LIMIT 200",
    params
  );
  return rows.rows.map(mapRow);
}

export async function getEntry(id: string): Promise<EntryRow | null> {
  const rows = await pool.query("SELECT " + COLUMNS + " FROM entries WHERE id = $1", [id]);
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function findEntryBySourceRef(source: string, sourceRef: string): Promise<EntryRow | null> {
  const rows = await pool.query("SELECT " + COLUMNS + " FROM entries WHERE source = $1 AND source_ref = $2", [source, sourceRef]);
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function createEntry(input: {
  source: EntryRow["source"];
  sourceRef?: string | null;
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  embedding: number[];
}): Promise<EntryRow | null> {
  const rows = await pool.query(
    "INSERT INTO entries (source, source_ref, title, content, summary, category, tags, embedding) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector) ON CONFLICT (source, source_ref) DO NOTHING RETURNING " + COLUMNS,
    [input.source, input.sourceRef ?? null, input.title, input.content, input.summary, input.category, JSON.stringify(input.tags), "[" + input.embedding.join(",") + "]"]
  );
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function updateEntry(id: string, patch: {
  title?: string;
  content?: string;
  summary?: string;
  category?: string;
  tags?: string[];
  assistantScope?: boolean;
  embedding?: number[];
}): Promise<EntryRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.title !== undefined) { params.push(patch.title); sets.push("title = $" + params.length); }
  if (patch.content !== undefined) { params.push(patch.content); sets.push("content = $" + params.length); }
  if (patch.summary !== undefined) { params.push(patch.summary); sets.push("summary = $" + params.length); }
  if (patch.category !== undefined) { params.push(patch.category); sets.push("category = $" + params.length); }
  if (patch.tags !== undefined) { params.push(JSON.stringify(patch.tags)); sets.push("tags = $" + params.length); }
  if (patch.assistantScope !== undefined) { params.push(patch.assistantScope); sets.push("assistant_scope = $" + params.length); }
  if (patch.embedding !== undefined) { params.push("[" + patch.embedding.join(",") + "]"); sets.push("embedding = $" + params.length + "::vector"); }
  if (sets.length === 0) return getEntry(id);
  sets.push("updated_at = now()");
  params.push(id);
  const rows = await pool.query(
    "UPDATE entries SET " + sets.join(", ") + " WHERE id = $" + params.length + " RETURNING " + COLUMNS,
    params
  );
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function setCategoryScope(category: string, scope: boolean): Promise<number> {
  const rows = await pool.query("UPDATE entries SET assistant_scope = $2, updated_at = now() WHERE category = $1", [category, scope]);
  return rows.rowCount ?? 0;
}
