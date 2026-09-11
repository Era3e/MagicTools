ALTER TABLE requirements DROP CONSTRAINT requirements_source_check;
ALTER TABLE requirements ADD CONSTRAINT requirements_source_check
  CHECK (source IN ('assessor','manual','github','cybercloud','audit_proposal'));
ALTER TABLE requirements ADD COLUMN project text NOT NULL DEFAULT '';
ALTER TABLE requirements ADD COLUMN acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE requirements ADD COLUMN evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE requirements ADD COLUMN dependency_refs jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE requirements ADD COLUMN automation_policy text NOT NULL DEFAULT 'manual' CHECK (automation_policy = 'manual');

CREATE TABLE capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  repository text NOT NULL,
  source_ref text NOT NULL,
  source_commit text NOT NULL,
  candidate_payload jsonb NOT NULL,
  implementation_state text NOT NULL DEFAULT 'observed_in_code',
  acceptance_state text NOT NULL DEFAULT 'not_verified',
  deployment_state text NOT NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE manager_import_links (
  repository text NOT NULL,
  candidate_id text NOT NULL,
  candidate_hash text NOT NULL,
  record_kind text NOT NULL CHECK (record_kind IN ('baseline','planned')),
  requirement_id uuid REFERENCES requirements(id),
  capability_id uuid REFERENCES capabilities(id),
  PRIMARY KEY(repository,candidate_id),
  CHECK ((record_kind='planned' AND requirement_id IS NOT NULL AND capability_id IS NULL)
      OR (record_kind='baseline' AND capability_id IS NOT NULL AND requirement_id IS NULL))
);
