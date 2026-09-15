ALTER TABLE requirements
  DROP CONSTRAINT IF EXISTS requirements_automation_policy_check;
ALTER TABLE requirements
  ADD CONSTRAINT requirements_automation_policy_check
  CHECK (automation_policy IN ('manual', 'owner-token'));

CREATE TABLE IF NOT EXISTS execution_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  requirement_revision integer NOT NULL,
  content_revision integer NOT NULL,
  contract jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'retry', 'succeeded', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts BETWEEN 1 AND 3),
  cancellation_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CONSTRAINT execution_jobs_revision_positive CHECK (requirement_revision > 0 AND content_revision > 0),
  CONSTRAINT execution_jobs_one_revision UNIQUE (requirement_id, content_revision)
);

CREATE TABLE IF NOT EXISTS execution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES execution_jobs(id) ON DELETE CASCADE,
  attempt integer NOT NULL CHECK (attempt > 0),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed', 'expired', 'cancelled')),
  executor_id text NOT NULL,
  run_token_hash text NOT NULL,
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz NOT NULL,
  hard_deadline_at timestamptz NOT NULL,
  result jsonb,
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT execution_runs_job_attempt UNIQUE (job_id, attempt),
  CONSTRAINT execution_runs_executor_format CHECK (executor_id ~ '^[A-Za-z0-9._-]{1,100}$'),
  CONSTRAINT execution_runs_deadline_after_lease CHECK (hard_deadline_at >= lease_expires_at)
);

CREATE INDEX IF NOT EXISTS execution_jobs_claim_idx
  ON execution_jobs (status, updated_at)
  WHERE status IN ('queued', 'retry');
CREATE INDEX IF NOT EXISTS execution_runs_recovery_idx
  ON execution_runs (lease_expires_at)
  WHERE status = 'running';
