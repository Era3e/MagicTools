import { pool } from "./db";
import { COLUMNS, mapRow, type EntryRow } from "./entry.repo";

export interface SearchRow extends EntryRow {
  score: number;
}

export async function ftsSearch(q: string, limit: number): Promise<SearchRow[]> {
  const rows = await pool.query(
    "SELECT " + COLUMNS + ", (CASE WHEN title ILIKE '%' || $1 || '%' OR content ILIKE '%' || $1 || '%' THEN 1.0 ELSE greatest(similarity(title, $1), similarity(content, $1)) END) AS score FROM entries WHERE title ILIKE '%' || $1 || '%' OR content ILIKE '%' || $1 || '%' OR similarity(title, $1) > 0.2 OR similarity(content, $1) > 0.2 ORDER BY score DESC, created_at DESC LIMIT $2",
    [q, limit]
  );
  return rows.rows.map((r) => ({ ...mapRow(r), score: Number(r.score) }));
}

export async function vectorSearch(vec: number[], limit: number): Promise<SearchRow[]> {
  const rows = await pool.query(
    "SELECT " + COLUMNS + ", (1 - (embedding <=> $1::vector)) AS score FROM entries WHERE embedding IS NOT NULL ORDER BY embedding <=> $1::vector LIMIT $2",
    ["[" + vec.join(",") + "]", limit]
  );
  return rows.rows.map((r) => ({ ...mapRow(r), score: Number(r.score) }));
}
