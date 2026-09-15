-- P19: immutable revision-level evidence chunks for public hybrid retrieval.
CREATE TABLE IF NOT EXISTS entry_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  revision_id uuid NOT NULL REFERENCES entry_revisions(id) ON DELETE CASCADE,
  chunk_no integer NOT NULL,
  content text NOT NULL,
  char_start integer NOT NULL,
  char_end integer NOT NULL,
  embedding vector(1024),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entry_chunks_revision_no_unique UNIQUE (revision_id, chunk_no),
  CONSTRAINT entry_chunks_no_positive CHECK (chunk_no > 0),
  CONSTRAINT entry_chunks_range_valid CHECK (char_start >= 0 AND char_end >= char_start)
);

-- Existing revisions are split deterministically by character windows. Their
-- document-level vectors are intentionally not copied: equal vectors on every
-- chunk would make cosine distance locate an arbitrary slice. FTS remains
-- available immediately; every later revision created by the app is
-- chunk-embedded by the repository before publication.
INSERT INTO entry_chunks
  (entry_id, revision_id, chunk_no, content, char_start, char_end, embedding)
SELECT er.entry_id, er.id, gs,
       substring(er.content from ((gs - 1) * 800 + 1) for 800),
       (gs - 1) * 800,
       least(gs * 800, char_length(er.content)),
       NULL::vector
FROM entry_revisions er
CROSS JOIN LATERAL generate_series(1, greatest(1, ceil(char_length(er.content) / 800.0))::integer) AS gs
WHERE NOT EXISTS (SELECT 1 FROM entry_chunks ec WHERE ec.revision_id = er.id);

CREATE INDEX IF NOT EXISTS idx_entry_chunks_revision ON entry_chunks (revision_id, chunk_no);
CREATE INDEX IF NOT EXISTS idx_entry_chunks_entry ON entry_chunks (entry_id);
