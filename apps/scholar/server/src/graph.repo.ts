import { pool } from "./db";

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  entryCount: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export async function clearGraph(): Promise<void> {
  await pool.query("TRUNCATE entry_entities, relations, entities");
}

export async function upsertEntity(name: string, type: string): Promise<string> {
  const rows = await pool.query(
    "INSERT INTO entities (name, type) VALUES ($1, $2) ON CONFLICT (name, type) DO UPDATE SET name = EXCLUDED.name RETURNING id",
    [name, type]
  );
  return rows.rows[0].id as string;
}

export async function findEntityIdByName(name: string): Promise<string | null> {
  const rows = await pool.query("SELECT id FROM entities WHERE name = $1 ORDER BY created_at LIMIT 1", [name]);
  return rows.rows[0] ? (rows.rows[0].id as string) : null;
}

export async function insertRelation(fromId: string, toId: string, label: string): Promise<void> {
  await pool.query(
    "INSERT INTO relations (from_id, to_id, label) VALUES ($1, $2, $3) ON CONFLICT (from_id, to_id, label) DO NOTHING",
    [fromId, toId, label]
  );
}

export async function linkEntryEntity(entryId: string, entityId: string): Promise<void> {
  await pool.query(
    "INSERT INTO entry_entities (entry_id, entity_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [entryId, entityId]
  );
}

export async function getGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const nodes = await pool.query(
    "SELECT e.id, e.name, e.type, count(ee.entry_id)::int AS entry_count FROM entities e LEFT JOIN entry_entities ee ON ee.entity_id = e.id GROUP BY e.id ORDER BY entry_count DESC, e.name"
  );
  const edges = await pool.query(
    "SELECT r.id, f.name AS from_name, t.name AS to_name, r.label FROM relations r JOIN entities f ON f.id = r.from_id JOIN entities t ON t.id = r.to_id ORDER BY r.label, f.name"
  );
  return {
    nodes: nodes.rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      type: r.type as string,
      entryCount: r.entry_count as number,
    })),
    edges: edges.rows.map((r) => ({
      id: r.id as string,
      from: r.from_name as string,
      to: r.to_name as string,
      label: r.label as string,
    })),
  };
}
