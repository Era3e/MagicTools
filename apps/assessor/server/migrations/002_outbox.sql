CREATE TABLE IF NOT EXISTS outbox (
  id text PRIMARY KEY,
  event text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox (status, attempts, occurred_at);
