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

export interface PublicChunkSearchRow {
  entryId: string;
  source: string;
  title: string;
  category: string;
  revisionId: string;
  revisionNo: number;
  sourceRevision: string;
  sourceUrl: string;
  productVersionId: string;
  productVersion: string;
  deploymentRef: string;
  chunkId: string;
  chunkNo: number;
  content: string;
  charStart: number;
  charEnd: number;
  score: number;
  requirementLinks: Array<{ requirementId: string; requirementUrl: string; source: string }>;
}

const PUBLIC_CHUNK_COLUMNS = `e.id AS entry_id,e.source,er.title,er.category,
  er.id AS revision_id,er.revision_no,er.source_revision,er.source_url,
  pv.id AS product_version_id,pv.version AS product_version,pv.deployment_ref,
  ec.id AS chunk_id,ec.chunk_no,ec.content,ec.char_start,ec.char_end,
  coalesce((
    SELECT json_agg(json_build_object(
      'requirementId',rrl.requirement_id,'requirementUrl',rrl.requirement_url,'source',rrl.source
    ) ORDER BY rrl.created_at,rrl.requirement_id)
    FROM revision_requirement_links rrl WHERE rrl.revision_id=er.id
  ),'[]') AS requirement_links`;

const PUBLIC_CHUNK_FROM = `FROM entries e
  JOIN knowledge_spaces ks ON ks.id=e.space_id
  JOIN entry_publications ep ON ep.entry_id=e.id AND ep.product_version_id=$3
  JOIN entry_revisions er ON er.id=ep.revision_id
  JOIN entry_chunks ec ON ec.revision_id=er.id
  JOIN product_versions pv ON pv.id=ep.product_version_id
  WHERE ks.kind='product' AND ks.visibility='public' AND pv.status='published' AND e.status='published'`;

function mapPublicChunk(row: Record<string, unknown>): PublicChunkSearchRow {
  return {
    entryId: row.entry_id as string,
    source: row.source as string,
    title: row.title as string,
    category: row.category as string,
    revisionId: row.revision_id as string,
    revisionNo: Number(row.revision_no),
    sourceRevision: (row.source_revision as string) ?? "",
    sourceUrl: (row.source_url as string) ?? "",
    productVersionId: row.product_version_id as string,
    productVersion: row.product_version as string,
    deploymentRef: row.deployment_ref as string,
    chunkId: row.chunk_id as string,
    chunkNo: Number(row.chunk_no),
    content: row.content as string,
    charStart: Number(row.char_start),
    charEnd: Number(row.char_end),
    score: Number(row.score),
    requirementLinks: (row.requirement_links as PublicChunkSearchRow["requirementLinks"]) ?? [],
  };
}

export async function publicChunkFtsSearch(
  q: string,
  limit: number,
  productVersionId: string
): Promise<PublicChunkSearchRow[]> {
  const rows = await pool.query(
    `SELECT ` + PUBLIC_CHUNK_COLUMNS + `,
      CASE WHEN er.title ILIKE '%' || $1 || '%' OR ec.content ILIKE '%' || $1 || '%' THEN 1.0
        ELSE greatest(similarity(er.title, $1), similarity(ec.content, $1)) END AS score
      ` + PUBLIC_CHUNK_FROM + `
        AND (er.title ILIKE '%' || $1 || '%' OR ec.content ILIKE '%' || $1 || '%'
          OR similarity(er.title, $1) > 0.2 OR similarity(ec.content, $1) > 0.2)
      ORDER BY score DESC,er.created_at DESC,ec.chunk_no ASC LIMIT $2`,
    [q, limit, productVersionId]
  );
  return rows.rows.map(mapPublicChunk);
}

export async function publicChunkVectorSearch(
  vec: number[],
  limit: number,
  productVersionId: string
): Promise<PublicChunkSearchRow[]> {
  const rows = await pool.query(
    `SELECT ` + PUBLIC_CHUNK_COLUMNS + `, (1 - (ec.embedding <=> $1::vector)) AS score
      ` + PUBLIC_CHUNK_FROM + ` AND ec.embedding IS NOT NULL
      ORDER BY ec.embedding <=> $1::vector LIMIT $2`,
    ["[" + vec.join(",") + "]", limit, productVersionId]
  );
  return rows.rows.map(mapPublicChunk);
}
