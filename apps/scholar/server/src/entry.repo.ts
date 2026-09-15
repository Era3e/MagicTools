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
  spaceId: string;
  spaceKey: string;
  spaceKind: "development" | "product";
  status: "draft" | "published" | "archived";
  currentRevisionId: string | null;
  revisionNo: number | null;
  sourceRevision: string;
  createdAt: string;
  updatedAt: string;
}

export const COLUMNS = `e.id, e.source, e.source_ref, e.title, e.content, e.summary, e.category, e.tags,
  e.assistant_scope, e.space_id, ks.key AS space_key, ks.kind AS space_kind, e.status,
  e.current_revision_id, er.revision_no, er.source_revision, e.created_at, e.updated_at`;

const ENTRY_FROM = `FROM entries e
  JOIN knowledge_spaces ks ON ks.id = e.space_id
  LEFT JOIN entry_revisions er ON er.id = e.current_revision_id`;

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
    spaceId: r.space_id as string,
    spaceKey: (r.space_key as string) ?? "development",
    spaceKind: ((r.space_kind as string) ?? "development") as EntryRow["spaceKind"],
    status: ((r.status as string) ?? "draft") as EntryRow["status"],
    currentRevisionId: (r.current_revision_id as string | null) ?? null,
    revisionNo: r.revision_no === null || r.revision_no === undefined ? null : Number(r.revision_no),
    sourceRevision: (r.source_revision as string) ?? "",
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

export async function listEntries(
  filters: { source?: string; category?: string; tag?: string; spaceKey?: string; status?: string } = {}
): Promise<EntryRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.source) { params.push(filters.source); where.push("e.source = $" + params.length); }
  if (filters.category) { params.push(filters.category); where.push("e.category = $" + params.length); }
  if (filters.tag) { params.push("e.tags ? $" + params.length); }
  if (filters.spaceKey) { params.push(filters.spaceKey); where.push("ks.key = $" + params.length); }
  if (filters.status) { params.push(filters.status); where.push("e.status = $" + params.length); }
  const rows = await pool.query(
    "SELECT " + COLUMNS + " " + ENTRY_FROM + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY e.created_at DESC LIMIT 200",
    params
  );
  return rows.rows.map(mapRow);
}

export async function getEntry(id: string): Promise<EntryRow | null> {
  const rows = await pool.query("SELECT " + COLUMNS + " " + ENTRY_FROM + " WHERE e.id = $1", [id]);
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export async function findEntryBySourceRef(source: string, sourceRef: string): Promise<EntryRow | null> {
  const rows = await pool.query("SELECT " + COLUMNS + " " + ENTRY_FROM + " WHERE e.source = $1 AND e.source_ref = $2", [source, sourceRef]);
  return rows.rows[0] ? mapRow(rows.rows[0]) : null;
}

export interface EntryMutationMetadata {
  spaceKey?: "development" | "product";
  source?: EntryRow["source"];
  sourceRevision?: string;
  sourceUrl?: string;
  requirementId?: string;
  requirementUrl?: string;
  createdBy?: string;
}

interface QueryLike {
  query: typeof pool.query;
}

async function insertRevision(
  client: QueryLike,
  entryId: string,
  revisionNo: number,
  values: { title: string; content: string; summary: string; category: string; tags: string[] },
  embedding: string,
  metadata: EntryMutationMetadata
): Promise<string> {
  const rows = await client.query(
    `INSERT INTO entry_revisions
      (entry_id, revision_no, title, content, summary, category, tags, source_revision, source_url, requirement_id, requirement_url, embedding, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12::vector,$13) RETURNING id`,
    [entryId, revisionNo, values.title, values.content, values.summary, values.category, JSON.stringify(values.tags),
      metadata.sourceRevision ?? "", metadata.sourceUrl ?? "", metadata.requirementId ?? "", metadata.requirementUrl ?? "",
      embedding, metadata.createdBy ?? ""]
  );
  const revisionId = rows.rows[0].id as string;
  await client.query(
    `INSERT INTO revision_requirement_links (revision_id,requirement_id,requirement_url,source)
     SELECT $1,requirement_id,requirement_url,source FROM entry_requirement_links WHERE entry_id=$2`,
    [revisionId, entryId]
  );
  return revisionId;
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
} & EntryMutationMetadata): Promise<EntryRow | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rows = await client.query(
      `INSERT INTO entries (source, source_ref, title, content, summary, category, tags, embedding, space_id, status)
       SELECT $1,$2,$3,$4,$5,$6,$7::jsonb,$8::vector,id,'draft' FROM knowledge_spaces WHERE key=$9
       ON CONFLICT (source, source_ref) DO NOTHING RETURNING id`,
      [input.source, input.sourceRef ?? null, input.title, input.content, input.summary, input.category,
        JSON.stringify(input.tags), "[" + input.embedding.join(",") + "]", input.spaceKey ?? "development"]
    );
    if (!rows.rows[0]) {
      await client.query("COMMIT");
      return null;
    }
    const entryId = rows.rows[0].id as string;
    if (input.requirementId) {
      await client.query(
        "INSERT INTO entry_requirement_links (entry_id, requirement_id, requirement_url, source) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [entryId, input.requirementId, input.requirementUrl ?? "", input.source]
      );
    }
    const revisionId = await insertRevision(client, entryId, 1, input, "[" + input.embedding.join(",") + "]", input);
    await client.query("UPDATE entries SET current_revision_id=$2 WHERE id=$1", [entryId, revisionId]);
    await client.query("COMMIT");
    return await getEntry(entryId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEntry(id: string, patch: {
  title?: string;
  content?: string;
  summary?: string;
  category?: string;
  tags?: string[];
  assistantScope?: boolean;
  embedding?: number[];
} & EntryMutationMetadata): Promise<EntryRow | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentRows = await client.query(
      `SELECT e.*,ks.key AS current_space_key,er.source_revision,er.source_url,er.requirement_id,er.requirement_url
       FROM entries e
       JOIN knowledge_spaces ks ON ks.id=e.space_id
       LEFT JOIN entry_revisions er ON er.id=e.current_revision_id
       WHERE e.id=$1 FOR UPDATE OF e`,
      [id]
    );
    const current = currentRows.rows[0];
    if (!current) {
      await client.query("COMMIT");
      return null;
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.title !== undefined) { params.push(patch.title); sets.push("title = $" + params.length); }
    if (patch.content !== undefined) { params.push(patch.content); sets.push("content = $" + params.length); }
    if (patch.summary !== undefined) { params.push(patch.summary); sets.push("summary = $" + params.length); }
    if (patch.category !== undefined) { params.push(patch.category); sets.push("category = $" + params.length); }
    if (patch.tags !== undefined) { params.push(JSON.stringify(patch.tags)); sets.push("tags = $" + params.length + "::jsonb"); }
    if (patch.assistantScope !== undefined) { params.push(patch.assistantScope); sets.push("assistant_scope = $" + params.length); }
    if (patch.embedding !== undefined) { params.push("[" + patch.embedding.join(",") + "]"); sets.push("embedding = $" + params.length + "::vector"); }
    let spaceChanged = false;
    if (patch.spaceKey !== undefined) {
      const spaceRows = await client.query("SELECT id FROM knowledge_spaces WHERE key=$1 FOR SHARE", [patch.spaceKey]);
      if (!spaceRows.rows[0]) throw new Error("知识空间不存在");
      if (patch.spaceKey !== current.current_space_key) {
        params.push(patch.spaceKey);
        sets.push("space_id = (SELECT id FROM knowledge_spaces WHERE key = $" + params.length + ")");
        spaceChanged = true;
      }
    }
    if (patch.requirementId) {
      await client.query(
        "INSERT INTO entry_requirement_links (entry_id, requirement_id, requirement_url, source) VALUES ($1,$2,$3,$4) ON CONFLICT (entry_id, requirement_id) DO UPDATE SET requirement_url=EXCLUDED.requirement_url, source=EXCLUDED.source",
        [id, patch.requirementId, patch.requirementUrl ?? "", patch.source ?? "manual"]
      );
    }
    const contentChanged = patch.title !== undefined || patch.content !== undefined || patch.summary !== undefined ||
      patch.category !== undefined || patch.tags !== undefined;
    const metadataChanged =
      (patch.sourceRevision !== undefined && patch.sourceRevision !== current.source_revision) ||
      (patch.sourceUrl !== undefined && patch.sourceUrl !== current.source_url) ||
      (patch.requirementId !== undefined && patch.requirementId !== current.requirement_id) ||
      (patch.requirementUrl !== undefined && patch.requirementUrl !== current.requirement_url);
    const requirementSnapshotChanged = Boolean((await client.query(
      `SELECT EXISTS (
         SELECT requirement_id,requirement_url,source FROM entry_requirement_links WHERE entry_id=$1
         EXCEPT
         SELECT requirement_id,requirement_url,source FROM revision_requirement_links WHERE revision_id=$2
       ) OR EXISTS (
         SELECT requirement_id,requirement_url,source FROM revision_requirement_links WHERE revision_id=$2
         EXCEPT
         SELECT requirement_id,requirement_url,source FROM entry_requirement_links WHERE entry_id=$1
       )`,
      [id, current.current_revision_id]
    )).rows[0]?.exists);
    const revisionChanged = contentChanged || metadataChanged || spaceChanged || requirementSnapshotChanged;
    if (sets.length === 0 && !revisionChanged) {
      await client.query("COMMIT");
      return await getEntry(id);
    }
    if (sets.length > 0) {
      sets.push("updated_at = now()");
      params.push(id);
      await client.query("UPDATE entries SET " + sets.join(", ") + " WHERE id = $" + params.length, params);
    }
    if (revisionChanged) {
      const nextNoRows = await client.query(
        "SELECT coalesce(max(revision_no),0)+1 AS next FROM entry_revisions WHERE entry_id=$1", [id]
      );
      const revisionId = await insertRevision(client, id, Number(nextNoRows.rows[0].next), {
        title: patch.title ?? current.title,
        content: patch.content ?? current.content,
        summary: patch.summary ?? current.summary,
        category: patch.category ?? current.category,
        tags: patch.tags ?? current.tags,
      }, patch.embedding ? "[" + patch.embedding.join(",") + "]" : current.embedding, {
        sourceRevision: patch.sourceRevision ?? current.source_revision,
        sourceUrl: patch.sourceUrl ?? current.source_url,
        requirementId: patch.requirementId ?? current.requirement_id,
        requirementUrl: patch.requirementUrl ?? current.requirement_url,
        createdBy: patch.createdBy,
      });
      await client.query("UPDATE entries SET current_revision_id=$2,updated_at=now() WHERE id=$1", [id, revisionId]);
    }
    await client.query("COMMIT");
    return await getEntry(id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setCategoryScope(category: string, scope: boolean): Promise<number> {
  const rows = await pool.query("UPDATE entries SET assistant_scope = $2, updated_at = now() WHERE category = $1", [category, scope]);
  return rows.rowCount ?? 0;
}

export async function listRequirementLinks(entryId: string): Promise<Array<{ requirementId: string; requirementUrl: string; source: string }>> {
  const rows = await pool.query(
    "SELECT requirement_id, requirement_url, source FROM entry_requirement_links WHERE entry_id=$1 ORDER BY created_at",
    [entryId]
  );
  return rows.rows.map((row) => ({
    requirementId: row.requirement_id,
    requirementUrl: row.requirement_url,
    source: row.source,
  }));
}
