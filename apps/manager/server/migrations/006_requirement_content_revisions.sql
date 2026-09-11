ALTER TABLE requirements ADD COLUMN content_revision integer NOT NULL DEFAULT 1 CHECK (content_revision > 0);
ALTER TABLE requirements ADD COLUMN scope text NOT NULL DEFAULT '';
ALTER TABLE requirements ADD COLUMN risk text NOT NULL DEFAULT 'unassessed'
  CHECK (risk IN ('unassessed','low','medium','high'));

CREATE FUNCTION manager_requirement_content(r requirements) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'title', r.title, 'description', r.description, 'project', r.project,
    'scope', r.scope, 'risk', r.risk, 'acceptanceCriteria', r.acceptance_criteria,
    'dependencyRefs', r.dependency_refs, 'evidenceRefs', r.evidence_refs
  );
$$;

CREATE TABLE requirement_revisions (
  requirement_id uuid NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  content_revision integer NOT NULL CHECK (content_revision > 0),
  content jsonb NOT NULL,
  origin text NOT NULL CHECK (origin IN ('backfill','created','edited')),
  created_from_revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(requirement_id,content_revision)
);

-- 存量记录只保存迁移时实际可见的内容，不编造先前的正文历史。
INSERT INTO requirement_revisions(requirement_id,content_revision,content,origin,created_from_revision)
SELECT id,content_revision,manager_requirement_content(r),'backfill',revision FROM requirements r;

CREATE FUNCTION manager_prepare_content_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    NEW.content_revision := 1;
  ELSIF manager_requirement_content(NEW) IS DISTINCT FROM manager_requirement_content(OLD) THEN
    NEW.content_revision := OLD.content_revision + 1;
  ELSE
    NEW.content_revision := OLD.content_revision;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION manager_capture_content_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO requirement_revisions(requirement_id,content_revision,content,origin,created_from_revision)
    VALUES(NEW.id,NEW.content_revision,manager_requirement_content(NEW),'created',NEW.revision);
  ELSIF NEW.content_revision <> OLD.content_revision THEN
    INSERT INTO requirement_revisions(requirement_id,content_revision,content,origin,created_from_revision)
    VALUES(NEW.id,NEW.content_revision,manager_requirement_content(NEW),'edited',NEW.revision);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER manager_content_prepare BEFORE INSERT OR UPDATE ON requirements
FOR EACH ROW EXECUTE FUNCTION manager_prepare_content_revision();
CREATE TRIGGER manager_content_capture AFTER INSERT OR UPDATE ON requirements
FOR EACH ROW EXECUTE FUNCTION manager_capture_content_revision();
