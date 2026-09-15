import { pool } from "./db";
import { COLUMNS, mapRow, type EntryRow } from "./entry.repo";

export interface SearchRow extends EntryRow {
  score: number;
}

const ENTRY_FROM = `FROM entries e
  JOIN knowledge_spaces ks ON ks.id = e.space_id
  LEFT JOIN entry_revisions er ON er.id = e.current_revision_id`;

export const PUBLIC_COLUMNS = `e.id,e.source,e.source_ref,er.title,er.content,er.summary,er.category,er.tags,
  e.assistant_scope,e.space_id,ks.key AS space_key,ks.kind AS space_kind,e.status,
  er.id AS current_revision_id,er.revision_no,er.source_revision,e.created_at,e.updated_at`;

export async function ftsSearch(q: string, limit: number): Promise<SearchRow[]> {
  const rows = await pool.query(
    "SELECT " + COLUMNS + ", (CASE WHEN e.title ILIKE '%' || $1 || '%' OR e.content ILIKE '%' || $1 || '%' THEN 1.0 ELSE greatest(similarity(e.title, $1), similarity(e.content, $1)) END) AS score " +
    ENTRY_FROM + " WHERE e.title ILIKE '%' || $1 || '%' OR e.content ILIKE '%' || $1 || '%' OR similarity(e.title, $1) > 0.2 OR similarity(e.content, $1) > 0.2 ORDER BY score DESC, e.created_at DESC LIMIT $2",
    [q, limit]
  );
  return rows.rows.map((r) => ({ ...mapRow(r), score: Number(r.score) }));
}

export async function vectorSearch(vec: number[], limit: number): Promise<SearchRow[]> {
  const rows = await pool.query(
    "SELECT " + COLUMNS + ", (1 - (e.embedding <=> $1::vector)) AS score " + ENTRY_FROM +
    " WHERE e.embedding IS NOT NULL ORDER BY e.embedding <=> $1::vector LIMIT $2",
    ["[" + vec.join(",") + "]", limit]
  );
  return rows.rows.map((r) => ({ ...mapRow(r), score: Number(r.score) }));
}

export async function publicFtsSearch(q: string, limit: number, productVersionId: string): Promise<SearchRow[]> {
  const rows = await pool.query(
    `SELECT ` + PUBLIC_COLUMNS + `, (CASE WHEN er.title ILIKE '%' || $1 || '%' OR er.content ILIKE '%' || $1 || '%' THEN 1.0
      ELSE greatest(similarity(er.title, $1), similarity(er.content, $1)) END) AS score
      FROM entries e
      JOIN knowledge_spaces ks ON ks.id = e.space_id
      JOIN entry_publications ep ON ep.entry_id = e.id AND ep.product_version_id = $3
      JOIN entry_revisions er ON er.id = ep.revision_id
      JOIN product_versions pv ON pv.id = ep.product_version_id
      WHERE ks.kind='product' AND ks.visibility='public' AND pv.status='published' AND e.status='published'
        AND (er.title ILIKE '%' || $1 || '%' OR er.content ILIKE '%' || $1 || '%' OR similarity(er.title, $1) > 0.2 OR similarity(er.content, $1) > 0.2)
      ORDER BY score DESC, e.created_at DESC LIMIT $2`,
    [q, limit, productVersionId]
  );
  return rows.rows.map((r) => ({ ...mapRow(r), score: Number(r.score) }));
}

export async function publicVectorSearch(vec: number[], limit: number, productVersionId: string): Promise<SearchRow[]> {
  const rows = await pool.query(
    `SELECT ` + PUBLIC_COLUMNS + `, (1 - (er.embedding <=> $1::vector)) AS score
      FROM entries e
      JOIN knowledge_spaces ks ON ks.id = e.space_id
      JOIN entry_publications ep ON ep.entry_id = e.id AND ep.product_version_id = $3
      JOIN entry_revisions er ON er.id = ep.revision_id
      JOIN product_versions pv ON pv.id = ep.product_version_id
      WHERE ks.kind='product' AND ks.visibility='public' AND pv.status='published' AND e.status='published' AND er.embedding IS NOT NULL
      ORDER BY er.embedding <=> $1::vector LIMIT $2`,
    ["[" + vec.join(",") + "]", limit, productVersionId]
  );
  return rows.rows.map((r) => ({ ...mapRow(r), score: Number(r.score) }));
}
