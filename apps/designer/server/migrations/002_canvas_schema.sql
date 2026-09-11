ALTER TABLE components ADD COLUMN IF NOT EXISTS schema jsonb;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS schema jsonb;
