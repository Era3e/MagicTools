CREATE TABLE IF NOT EXISTS operations_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  kind text NOT NULL
    CHECK (kind IN ('host', 'database', 'registry', 'domain', 'external-api', 'deployment')),
  environment text NOT NULL
    CHECK (environment IN ('development', 'staging', 'production')),
  owner text NOT NULL,
  provider text NOT NULL,
  region text NOT NULL DEFAULT '',
  monthly_budget_cents integer NOT NULL CHECK (monthly_budget_cents BETWEEN 0 AND 1000000000),
  backup_reference text NOT NULL,
  runbook_url text NOT NULL,
  notes text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations_secret_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES operations_resources(id) ON DELETE CASCADE,
  name text NOT NULL,
  source text NOT NULL CHECK (source IN ('env', 'file', 'external')),
  reference text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_secret_refs_resource_name UNIQUE (resource_id, name)
);

CREATE TABLE IF NOT EXISTS operations_resource_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES operations_resources(id) ON DELETE CASCADE,
  name text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('passed', 'failed', 'blocked', 'waiting')),
  detail text NOT NULL DEFAULT '',
  evidence_url text NOT NULL DEFAULT '',
  checked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_resource_checks_identity UNIQUE (resource_id, name, checked_at)
);

CREATE INDEX IF NOT EXISTS idx_operations_resources_environment
  ON operations_resources (environment, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_operations_secret_refs_resource
  ON operations_secret_refs (resource_id, name);
CREATE INDEX IF NOT EXISTS idx_operations_resource_checks_latest
  ON operations_resource_checks (resource_id, name, checked_at DESC);
