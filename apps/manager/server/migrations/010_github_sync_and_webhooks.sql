CREATE TABLE IF NOT EXISTS github_webhook_deliveries (
  delivery_id text PRIMARY KEY,
  event text NOT NULL,
  action text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'done', 'error')),
  locked_by text,
  lease_expires_at timestamptz,
  payload_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_webhook_delivery_reclaim
  ON github_webhook_deliveries (lease_expires_at)
  WHERE status = 'processing';

ALTER TABLE requirements ADD COLUMN IF NOT EXISTS github_last_event_at timestamptz;
