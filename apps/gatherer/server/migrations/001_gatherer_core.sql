CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'rss',
  url text NOT NULL DEFAULT '',
  cron text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sources_type_check CHECK (type IN ('rss','json_api','web')),
  CONSTRAINT sources_status_check CHECK (status IN ('active','paused'))
);

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  published_at timestamptz,
  fingerprint text NOT NULL,
  category text NOT NULL DEFAULT '',
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text NOT NULL DEFAULT '',
  llm_enriched boolean NOT NULL DEFAULT false,
  pushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT items_unique_fingerprint UNIQUE (source_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched_count integer NOT NULL DEFAULT 0,
  new_count integer NOT NULL DEFAULT 0,
  error text
);
