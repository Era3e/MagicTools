CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
