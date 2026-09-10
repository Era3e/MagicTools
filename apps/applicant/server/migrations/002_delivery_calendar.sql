ALTER TABLE positions ADD COLUMN IF NOT EXISTS applied_at timestamptz;

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'done';
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_status_check;
ALTER TABLE interviews ADD CONSTRAINT interviews_status_check CHECK (status IN ('scheduled','done'));
