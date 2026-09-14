ALTER TABLE outbox ADD COLUMN IF NOT EXISTS locked_by text;
ALTER TABLE outbox ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_outbox_reclaim
  ON outbox (lease_expires_at, occurred_at)
  WHERE status = 'processing';
