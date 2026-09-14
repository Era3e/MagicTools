ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_source_check;
ALTER TABLE requirements ADD CONSTRAINT requirements_source_check
  CHECK (source IN ('assessor','manual','github','cybercloud','audit_proposal','assistant_badcase'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_requirements_assistant_badcase_source_ref
  ON requirements (source, source_ref)
  WHERE source='assistant_badcase' AND source_ref <> '';
