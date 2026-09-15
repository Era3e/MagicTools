import { pool } from "./db";
import { mapRow, type EntryRow } from "./entry.repo";

export type SpaceKind = "development" | "product";
export type SpaceVisibility = "private" | "public";
export type MemberRole = "owner" | "editor" | "viewer";

export interface KnowledgeSpaceRow {
  id: string;
  key: string;
  name: string;
  kind: SpaceKind;
  visibility: SpaceVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVersionRow {
  id: string;
  spaceId: string;
  spaceKey: string;
  version: string;
  status: "draft" | "published" | "archived";
  sourceRevision: string;
  deploymentRef: string;
  releasedAt: string | null;
  createdAt: string;
}

export interface AccessIdentity {
  userId: string | null;
  role: "admin" | "user" | "service" | null;
}

function mapSpace(row: Record<string, unknown>): KnowledgeSpaceRow {
  return {
    id: row.id as string,
    key: row.key as string,
    name: row.name as string,
    kind: row.kind as SpaceKind,
    visibility: row.visibility as SpaceVisibility,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

function mapVersion(row: Record<string, unknown>): ProductVersionRow {
  return {
    id: row.id as string,
    spaceId: row.space_id as string,
    spaceKey: row.space_key as string,
    version: row.version as string,
    status: row.status as ProductVersionRow["status"],
    sourceRevision: (row.source_revision as string) ?? "",
    deploymentRef: (row.deployment_ref as string) ?? "",
    releasedAt: row.released_at ? new Date(row.released_at as string).toISOString() : null,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export async function listSpaces(identity: AccessIdentity): Promise<KnowledgeSpaceRow[]> {
  const rows = identity.role === "admin"
    ? await pool.query("SELECT * FROM knowledge_spaces ORDER BY kind, key")
    : await pool.query(
        `SELECT s.* FROM knowledge_spaces s
         LEFT JOIN knowledge_space_members m ON m.space_id=s.id AND m.user_id=$1
         WHERE m.user_id IS NOT NULL OR (s.kind='product' AND s.visibility='public')
         ORDER BY s.kind,s.key`,
        [identity.userId ?? ""]
      );
  return rows.rows.map(mapSpace);
}

export async function getSpaceByKey(key: string): Promise<KnowledgeSpaceRow | null> {
  const rows = await pool.query("SELECT * FROM knowledge_spaces WHERE key=$1", [key]);
  return rows.rows[0] ? mapSpace(rows.rows[0]) : null;
}

export async function createSpace(input: {
  key: string; name: string; kind: SpaceKind; visibility: SpaceVisibility; ownerId: string;
}): Promise<KnowledgeSpaceRow | null> {
  const rows = await pool.query(
    `WITH inserted AS (
       INSERT INTO knowledge_spaces (key,name,kind,visibility) VALUES ($1,$2,$3,$4)
       ON CONFLICT (key) DO NOTHING RETURNING *
     )
     INSERT INTO knowledge_space_members (space_id,user_id,role)
     SELECT id,$5,'owner' FROM inserted
     ON CONFLICT DO NOTHING
     RETURNING space_id`,
    [input.key, input.name, input.kind, input.visibility, input.ownerId]
  );
  if (!rows.rows[0]) return null;
  return getSpaceByKey(input.key);
}

export async function upsertMember(spaceId: string, userId: string, role: MemberRole): Promise<void> {
  await pool.query(
    `INSERT INTO knowledge_space_members (space_id,user_id,role) VALUES ($1,$2,$3)
     ON CONFLICT (space_id,user_id) DO UPDATE SET role=EXCLUDED.role`,
    [spaceId, userId, role]
  );
}

export async function removeMember(spaceId: string, userId: string): Promise<number> {
  const rows = await pool.query("DELETE FROM knowledge_space_members WHERE space_id=$1 AND user_id=$2", [spaceId, userId]);
  return rows.rowCount ?? 0;
}

export async function isSpaceMember(spaceId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const rows = await pool.query("SELECT 1 FROM knowledge_space_members WHERE space_id=$1 AND user_id=$2", [spaceId, userId]);
  return Boolean(rows.rows[0]);
}

export async function createProductVersion(input: {
  spaceId: string; version: string; sourceRevision: string; deploymentRef: string;
}): Promise<ProductVersionRow> {
  const rows = await pool.query(
    `INSERT INTO product_versions (space_id,version,source_revision,deployment_ref)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [input.spaceId, input.version, input.sourceRevision, input.deploymentRef]
  );
  return getProductVersion(rows.rows[0].id as string);
}

export async function getProductVersion(id: string): Promise<ProductVersionRow> {
  const rows = await pool.query(
    `SELECT pv.*,s.key AS space_key FROM product_versions pv
     JOIN knowledge_spaces s ON s.id=pv.space_id WHERE pv.id=$1`,
    [id]
  );
  if (!rows.rows[0]) throw new Error("产品版本不存在");
  return mapVersion(rows.rows[0]);
}

export async function getCurrentPublicVersion(): Promise<ProductVersionRow | null> {
  const rows = await pool.query(
    `SELECT pv.*,s.key AS space_key FROM product_versions pv
     JOIN knowledge_spaces s ON s.id=pv.space_id
     WHERE s.key='product' AND s.kind='product' AND s.visibility='public' AND pv.status='published'
     ORDER BY pv.released_at DESC,pv.created_at DESC LIMIT 1`
  );
  return rows.rows[0] ? mapVersion(rows.rows[0]) : null;
}

export async function publishProductVersion(input: {
  versionId: string; entryIds: string[]; deploymentRef: string; publishedBy: string;
}): Promise<{ updated: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const versionRows = await client.query(
      `SELECT pv.id,pv.space_id,pv.status,pv.source_revision,s.kind
       FROM product_versions pv JOIN knowledge_spaces s ON s.id=pv.space_id
       WHERE pv.id=$1 FOR UPDATE OF pv`,
      [input.versionId]
    );
    const version = versionRows.rows[0];
    if (!version) throw new Error("产品版本不存在");
    if (version.kind !== "product") throw new Error("只有产品知识空间可发布");
    if (version.status !== "draft") throw new Error("产品版本已发布或已归档");
    if (!input.deploymentRef.trim()) throw new Error("发布必须绑定部署标识");

    const uniqueEntryIds = [...new Set(input.entryIds)];
    const entryRows = await client.query(
      `SELECT id,current_revision_id,status,space_id FROM entries
       WHERE id=ANY($1::uuid[]) AND space_id=$2 FOR UPDATE`,
      [uniqueEntryIds, version.space_id]
    );
    if (entryRows.rowCount !== uniqueEntryIds.length) throw new Error("发布条目必须属于同一产品空间");
    for (const entry of entryRows.rows) {
      if (!entry.current_revision_id) throw new Error("条目缺少不可变修订，拒绝发布");
      await client.query(
        `INSERT INTO entry_publications (entry_id,product_version_id,revision_id,published_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (entry_id,product_version_id) DO UPDATE SET revision_id=EXCLUDED.revision_id,published_by=EXCLUDED.published_by,published_at=now()`,
        [entry.id, input.versionId, entry.current_revision_id, input.publishedBy]
      );
    }
    await client.query(
      `UPDATE entries SET status='published',updated_at=now() WHERE id=ANY($1::uuid[])`,
      [uniqueEntryIds]
    );
    await client.query(
      `UPDATE product_versions SET status='published',deployment_ref=$2,released_at=now() WHERE id=$1`,
      [input.versionId, input.deploymentRef]
    );
    await client.query("COMMIT");
    return { updated: uniqueEntryIds.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const PUBLIC_ENTRY_SELECT = `SELECT e.id,e.source,e.source_ref,er.title,er.content,er.summary,er.category,er.tags,
  e.assistant_scope,e.space_id,ks.key AS space_key,ks.kind AS space_kind,e.status,
  er.id AS current_revision_id,er.revision_no,er.source_revision,e.created_at,e.updated_at,
  pv.version AS product_version,pv.id AS product_version_id,pv.deployment_ref,
  coalesce((
    SELECT json_agg(json_build_object(
      'requirementId',rrl.requirement_id,'requirementUrl',rrl.requirement_url,'source',rrl.source
    ) ORDER BY rrl.created_at,rrl.requirement_id)
    FROM revision_requirement_links rrl WHERE rrl.revision_id=er.id
  ),'[]') AS requirement_links
  FROM entries e
  JOIN knowledge_spaces ks ON ks.id=e.space_id
  JOIN entry_publications ep ON ep.entry_id=e.id
  JOIN entry_revisions er ON er.id=ep.revision_id
  JOIN product_versions pv ON pv.id=ep.product_version_id AND pv.status='published'
  WHERE ks.key='product' AND ks.kind='product' AND ks.visibility='public' AND e.status='published'`;

export interface PublicEntryRow extends EntryRow {
  productVersion: string;
  productVersionId: string;
  deploymentRef: string;
  requirementLinks: Array<{ requirementId: string; requirementUrl: string; source: string }>;
}

function mapPublicEntry(row: Record<string, unknown>): PublicEntryRow {
  return {
    ...mapRow(row),
    productVersion: row.product_version as string,
    productVersionId: row.product_version_id as string,
    deploymentRef: row.deployment_ref as string,
    requirementLinks: (row.requirement_links as PublicEntryRow["requirementLinks"]) ?? [],
  };
}

export async function listPublicEntries(versionId: string): Promise<PublicEntryRow[]> {
  const rows = await pool.query(
    PUBLIC_ENTRY_SELECT + " AND pv.id=$1 ORDER BY e.created_at DESC LIMIT 200",
    [versionId]
  );
  return rows.rows.map(mapPublicEntry);
}

export async function getPublicEntry(versionId: string, id: string): Promise<PublicEntryRow | null> {
  const rows = await pool.query(
    PUBLIC_ENTRY_SELECT + " AND pv.id=$1 AND e.id=$2 LIMIT 1",
    [versionId, id]
  );
  return rows.rows[0] ? mapPublicEntry(rows.rows[0]) : null;
}

export async function invalidateEntryForPublicAccess(entryId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM entry_entities WHERE entry_id=$1", [entryId]);
    await client.query("UPDATE entries SET embedding=NULL,status='draft',updated_at=now() WHERE id=$1", [entryId]);
    await client.query("DELETE FROM entry_publications WHERE entry_id=$1", [entryId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteEntryCompletely(entryId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM entry_entities WHERE entry_id=$1", [entryId]);
    await client.query("UPDATE entries SET current_revision_id=NULL,embedding=NULL WHERE id=$1", [entryId]);
    await client.query("DELETE FROM entries WHERE id=$1", [entryId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
