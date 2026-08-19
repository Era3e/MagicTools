CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'manual',
  source_ref text,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  embedding vector(1024),
  assistant_scope boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entries_source_check CHECK (source IN ('gatherer','manual','obsidian')),
  CONSTRAINT entries_unique_source_ref UNIQUE (source, source_ref)
);

CREATE INDEX IF NOT EXISTS idx_entries_trgm ON entries USING gin (title gin_trgm_ops, content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries (category);
CREATE INDEX IF NOT EXISTS idx_entries_source ON entries (source);

CREATE TABLE IF NOT EXISTS entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entities_unique_name_type UNIQUE (name, type)
);

CREATE TABLE IF NOT EXISTS relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT relations_unique UNIQUE (from_id, to_id, label)
);

CREATE TABLE IF NOT EXISTS entry_entities (
  entry_id uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, entity_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);
