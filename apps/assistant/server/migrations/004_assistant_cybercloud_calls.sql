CREATE TABLE IF NOT EXISTS cybercloud_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL,
  endpoint text NOT NULL DEFAULT '',
  ok boolean NOT NULL,
  latency_ms integer NOT NULL DEFAULT 0,
  error text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cybercloud_calls_created ON cybercloud_calls (created_at DESC);
