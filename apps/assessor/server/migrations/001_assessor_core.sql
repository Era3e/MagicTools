CREATE TABLE IF NOT EXISTS analysis_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_name text NOT NULL DEFAULT '',
  source_event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  context_text text NOT NULL DEFAULT '',
  repo_url text NOT NULL DEFAULT '',
  repo_context jsonb,
  analysis_md text,
  design_md text,
  review_comment text,
  pushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analysis_requests_status_check CHECK (status IN ('pending','draft','review','approved','rejected'))
);

CREATE TABLE IF NOT EXISTS analysis_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES analysis_requests(id) ON DELETE CASCADE,
  response_id text NOT NULL,
  structured jsonb NOT NULL DEFAULT '{}'::jsonb,
  sentiment text NOT NULL DEFAULT 'neutral',
  priority text NOT NULL DEFAULT 'P2',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analysis_items_unique UNIQUE (request_id, response_id)
);
