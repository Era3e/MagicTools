CREATE TABLE IF NOT EXISTS intent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL DEFAULT '',
  domain text NOT NULL DEFAULT '',
  intent text NOT NULL DEFAULT '',
  confidence numeric(3,2) NOT NULL DEFAULT 1,
  corrected_intent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_logs_created ON intent_logs (created_at DESC);
