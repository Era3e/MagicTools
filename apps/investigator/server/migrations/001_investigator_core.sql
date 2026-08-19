CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'feishu_bitable',
  app_token text NOT NULL DEFAULT '',
  table_id text NOT NULL DEFAULT '',
  answer_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT surveys_status_check CHECK (status IN ('active','archived'))
);

CREATE TABLE IF NOT EXISTS responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  record_id text NOT NULL,
  raw_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  structured jsonb NOT NULL DEFAULT '{}'::jsonb,
  sentiment text NOT NULL DEFAULT 'neutral',
  priority text NOT NULL DEFAULT 'P2',
  summary text NOT NULL DEFAULT '',
  pushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT responses_unique_record UNIQUE (survey_id, record_id),
  CONSTRAINT responses_sentiment_check CHECK (sentiment IN ('positive','neutral','negative')),
  CONSTRAINT responses_priority_check CHECK (priority IN ('P0','P1','P2'))
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  error text
);
