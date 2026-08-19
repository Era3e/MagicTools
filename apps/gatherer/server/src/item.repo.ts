import { pool } from "./db";

export interface ItemRow {
  id: string;
  sourceId: string;
  url: string;
  title: string;
  content: string;
  publishedAt: string | null;
  fingerprint: string;
  category: string;
  keywords: string[];
  summary: string;
  llmEnriched: boolean;
  pushedAt: string | null;
  createdAt: string;
}

function mapRow(r: Record<string, unknown>): ItemRow {
  return {
    id: r.id as string,
    sourceId: r.source_id as string,
    url: r.url as string,
    title: r.title as string,
    content: r.content as string,
    publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
    fingerprint: r.fingerprint as string,
    category: r.category as string,
    keywords: (r.keywords as string[]) ?? [],
    summary: r.summary as string,
    llmEnriched: Boolean(r.llm_enriched),
    pushedAt: r.pushed_at ? new Date(r.pushed_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

export async function listItems(filters: { sourceId?: string; pushed?: string } = {}): Promise<ItemRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.sourceId) { params.push(filters.sourceId); where.push("source_id = $" + params.length); }
  if (filters.pushed === "true") { where.push("pushed_at IS NOT NULL"); }
  if (filters.pushed === "false") { where.push("pushed_at IS NULL"); }
  const rows = await pool.query(
    "SELECT * FROM items" + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY created_at DESC LIMIT 200",
    params
  );
  return rows.rows.map(mapRow);
}

export async function upsertItem(input: {
  sourceId: string;
  url: string;
  title: string;
  content: string;
  publishedAt?: string;
  fingerprint: string;
  category: string;
  keywords: string[];
  summary: string;
  llmEnriched: boolean;
}): Promise<boolean> {
  const rows = await pool.query(
    "INSERT INTO items (source_id, url, title, content, published_at, fingerprint, category, keywords, summary, llm_enriched) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (source_id, fingerprint) DO NOTHING RETURNING id",
    [input.sourceId, input.url, input.title, input.content, input.publishedAt ?? null, input.fingerprint, input.category, JSON.stringify(input.keywords), input.summary, input.llmEnriched]
  );
  return (rows.rowCount ?? 0) > 0;
}

export async function startRun(sourceId: string): Promise<string> {
  const rows = await pool.query("INSERT INTO runs (source_id) VALUES ($1) RETURNING id", [sourceId]);
  return rows.rows[0].id as string;
}

export async function finishRun(runId: string, stats: { fetchedCount: number; newCount: number; error?: string }): Promise<void> {
  await pool.query("UPDATE runs SET finished_at = now(), fetched_count = $2, new_count = $3, error = $4 WHERE id = $1", [runId, stats.fetchedCount, stats.newCount, stats.error ?? null]);
}

export async function markPushed(ids: string[]): Promise<void> {
  await pool.query("UPDATE items SET pushed_at = now() WHERE id = ANY($1::uuid[])", [ids]);
}
