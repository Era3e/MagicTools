-- P18: development/product knowledge spaces and immutable publication evidence.
CREATE TABLE IF NOT EXISTS knowledge_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_spaces_key_unique UNIQUE (key),
  CONSTRAINT knowledge_spaces_kind_check CHECK (kind IN ('development','product')),
  CONSTRAINT knowledge_spaces_visibility_check CHECK (visibility IN ('private','public'))
);

CREATE TABLE IF NOT EXISTS knowledge_space_members (
  space_id uuid NOT NULL REFERENCES knowledge_spaces(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id),
  CONSTRAINT knowledge_space_members_role_check CHECK (role IN ('owner','editor','viewer'))
);

CREATE TABLE IF NOT EXISTS product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES knowledge_spaces(id) ON DELETE CASCADE,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  source_revision text NOT NULL DEFAULT '',
  deployment_ref text NOT NULL DEFAULT '',
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_versions_space_version_unique UNIQUE (space_id, version),
  CONSTRAINT product_versions_status_check CHECK (status IN ('draft','published','archived'))
);

INSERT INTO knowledge_spaces (key, name, kind, visibility) VALUES
  ('development', '开发知识空间', 'development', 'private'),
  ('product', '产品帮助空间', 'product', 'public')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE entries ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES knowledge_spaces(id) ON DELETE RESTRICT;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS current_revision_id uuid;

UPDATE entries e
SET space_id = s.id
FROM knowledge_spaces s
WHERE s.key = 'development' AND e.space_id IS NULL;

ALTER TABLE entries ALTER COLUMN space_id SET NOT NULL;
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_status_check;
ALTER TABLE entries ADD CONSTRAINT entries_status_check CHECK (status IN ('draft','published','archived'));

CREATE TABLE IF NOT EXISTS entry_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  revision_no integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  summary text NOT NULL,
  category text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_revision text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  requirement_id text NOT NULL DEFAULT '',
  requirement_url text NOT NULL DEFAULT '',
  embedding vector(1024),
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entry_revisions_entry_no_unique UNIQUE (entry_id, revision_no),
  CONSTRAINT entry_revisions_no_positive CHECK (revision_no > 0)
);

CREATE TABLE IF NOT EXISTS revision_requirement_links (
  revision_id uuid NOT NULL REFERENCES entry_revisions(id) ON DELETE CASCADE,
  requirement_id text NOT NULL,
  requirement_url text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (revision_id, requirement_id)
);

INSERT INTO entry_revisions
  (entry_id, revision_no, title, content, summary, category, tags, source_revision, source_url,
   requirement_id, requirement_url, embedding, created_by)
SELECT e.id, 1, e.title, e.content, e.summary, e.category, e.tags,
       '', '', '', '', e.embedding, 'legacy-backfill'
FROM entries e
WHERE NOT EXISTS (SELECT 1 FROM entry_revisions er WHERE er.entry_id = e.id);

UPDATE entries e
SET current_revision_id = er.id
FROM entry_revisions er
WHERE er.entry_id = e.id AND er.revision_no = 1 AND e.current_revision_id IS NULL;

ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_current_revision_fk;
ALTER TABLE entries ADD CONSTRAINT entries_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES entry_revisions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS entry_requirement_links (
  entry_id uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  requirement_id text NOT NULL,
  requirement_url text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, requirement_id)
);

INSERT INTO revision_requirement_links (revision_id,requirement_id,requirement_url,source)
SELECT er.id,rl.requirement_id,rl.requirement_url,rl.source
FROM entry_revisions er
JOIN entry_requirement_links rl ON rl.entry_id=er.entry_id
WHERE er.revision_no=1;

CREATE TABLE IF NOT EXISTS entry_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  product_version_id uuid NOT NULL REFERENCES product_versions(id) ON DELETE CASCADE,
  revision_id uuid NOT NULL REFERENCES entry_revisions(id) ON DELETE RESTRICT,
  published_by text NOT NULL DEFAULT '',
  published_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entry_publications_entry_version_unique UNIQUE (entry_id, product_version_id)
);

CREATE INDEX IF NOT EXISTS idx_entries_space_status ON entries (space_id, status);
CREATE INDEX IF NOT EXISTS idx_entry_revisions_entry ON entry_revisions (entry_id, revision_no DESC);
CREATE INDEX IF NOT EXISTS idx_entry_publications_version ON entry_publications (product_version_id);
CREATE INDEX IF NOT EXISTS idx_product_versions_space_status ON product_versions (space_id, status, released_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_spaces_single_product
  ON knowledge_spaces (kind) WHERE kind = 'product';
