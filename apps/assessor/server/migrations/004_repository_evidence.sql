CREATE TABLE IF NOT EXISTS repository_evidence_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo text NOT NULL,
  commit_sha text NOT NULL,
  commit_message text NOT NULL DEFAULT '',
  total_files integer NOT NULL CHECK (total_files >= 0),
  selected_files integer NOT NULL CHECK (selected_files >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repository_evidence_task_unique UNIQUE (repo, commit_sha)
);

CREATE TABLE IF NOT EXISTS repository_evidence_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES repository_evidence_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  motivation text NOT NULL DEFAULT 'unknown',
  category text NOT NULL,
  path text NOT NULL,
  content_sha256 text NOT NULL,
  evidence jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repository_evidence_category_check
    CHECK (category IN ('routes','controller','service','schema','tests')),
  CONSTRAINT repository_evidence_candidate_unique UNIQUE (task_id, category, path)
);

CREATE INDEX IF NOT EXISTS idx_repository_evidence_task_updated
  ON repository_evidence_tasks (updated_at DESC);
