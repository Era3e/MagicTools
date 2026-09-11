import { pool } from "./db";
import { CONTENT_FIELDS, type RequirementContent } from "./requirement-content";

export interface RequirementVersion {
  contentRevision: number;
  content: RequirementContent;
  origin: "backfill" | "created" | "edited";
  createdFromRevision: number;
  createdAt: string;
  changedFields: string[];
}

export async function getRequirementRevisions(id: string, limit = 20, before?: number) {
  // 单条查询保证当前版本、总数和分页内容处于同一个数据库读取快照。
  const rows = await pool.query(
    `SELECT r.content_revision,
      (SELECT count(*)::int FROM requirement_revisions WHERE requirement_id=r.id) AS total,
      (SELECT coalesce(jsonb_agg(v ORDER BY v.content_revision DESC),'[]'::jsonb) FROM (
        SELECT content_revision,content,origin,created_from_revision,created_at FROM requirement_revisions
        WHERE requirement_id=r.id AND ($2::integer IS NULL OR content_revision<$2)
        ORDER BY content_revision DESC LIMIT $3
      ) v) AS items
    FROM requirements r WHERE r.id=$1`, [id, before ?? null, limit + 1]
  );
  if (!rows.rowCount) return null;
  const raw = rows.rows[0].items as Array<{ content_revision: number; content: RequirementContent;
    origin: RequirementVersion["origin"]; created_from_revision: number; created_at: string }>;
  const items: RequirementVersion[] = raw.slice(0, limit).map((row, index) => ({
    contentRevision: row.content_revision, content: row.content, origin: row.origin,
    createdFromRevision: row.created_from_revision, createdAt: new Date(row.created_at).toISOString(),
    changedFields: raw[index + 1] ? CONTENT_FIELDS.filter((field) =>
      JSON.stringify(row.content[field]) !== JSON.stringify(raw[index + 1].content[field])) : [],
  }));
  return { currentContentRevision: Number(rows.rows[0].content_revision), total: Number(rows.rows[0].total),
    items, nextBefore: raw.length > limit ? items[items.length - 1].contentRevision : null };
}
