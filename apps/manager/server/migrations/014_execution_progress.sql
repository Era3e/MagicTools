ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS pr_state text NOT NULL DEFAULT 'unknown';
ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS pr_checked_at timestamptz;
ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS deployment_state text NOT NULL DEFAULT 'not-started';
ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS deployment_ref text NOT NULL DEFAULT '';
ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS deployment_url text NOT NULL DEFAULT '';
ALTER TABLE requirements
  ADD COLUMN IF NOT EXISTS deployment_checked_at timestamptz;

ALTER TABLE requirements
  DROP CONSTRAINT IF EXISTS requirements_pr_state_check;
ALTER TABLE requirements
  ADD CONSTRAINT requirements_pr_state_check
  CHECK (pr_state IN ('unknown', 'open', 'merged', 'closed'));

ALTER TABLE requirements
  DROP CONSTRAINT IF EXISTS requirements_deployment_state_check;
ALTER TABLE requirements
  ADD CONSTRAINT requirements_deployment_state_check
  CHECK (deployment_state IN ('not-started', 'pending', 'deploying', 'succeeded', 'failed', 'rolled-back'));

CREATE INDEX IF NOT EXISTS idx_execution_notifications
  ON outbox (event, status, occurred_at);
