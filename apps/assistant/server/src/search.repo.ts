import { scholarPool } from "./db";

export interface KnowledgeHit {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  score: number;
}

function mapHit(r: Record<string, unknown>): KnowledgeHit {
  return {
    id: r.id as string,
    title: r.title as string,
    content: r.content as string,
    source: r.source as string,
    category: r.category as string,
    score: Number(r.score),
  };
}

export async function vectorSearchScoped(vec: number[], limit = 5): Promise<KnowledgeHit[]> {
  const rows = await scholarPool().query(
    "SELECT id, title, content, source, category, (1 - (embedding <=> $1::vector)) AS score FROM entries WHERE assistant_scope = true AND embedding IS NOT NULL ORDER BY embedding <=> $1::vector LIMIT $2",
    ["[" + vec.join(",") + "]", limit]
  );
  return rows.rows.map(mapHit);
}

export async function ftsSearchScoped(q: string, limit = 5): Promise<KnowledgeHit[]> {
  const rows = await scholarPool().query(
    "SELECT id, title, content, source, category, 1.0 AS score FROM entries WHERE assistant_scope = true AND (title ILIKE '%' || $1 || '%' OR content ILIKE '%' || $1 || '%') ORDER BY created_at DESC LIMIT $2",
    [q, limit]
  );
  return rows.rows.map(mapHit);
}
