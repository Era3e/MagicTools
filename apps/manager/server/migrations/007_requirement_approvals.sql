ALTER TABLE requirements ADD COLUMN approved_content_revision integer;
ALTER TABLE requirements ADD CONSTRAINT requirement_approved_content_fk
  FOREIGN KEY(id,approved_content_revision) REFERENCES requirement_revisions(requirement_id,content_revision)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE requirement_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  content_revision integer NOT NULL,
  requirement_revision integer NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','revoked')),
  actor_id text NOT NULL,
  auth_method text NOT NULL CHECK (auth_method='owner-token'),
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(requirement_id,content_revision) REFERENCES requirement_revisions(requirement_id,content_revision) ON DELETE CASCADE,
  UNIQUE(requirement_id,requirement_revision)
);
