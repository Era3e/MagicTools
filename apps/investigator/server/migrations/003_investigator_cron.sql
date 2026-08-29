-- Investigator: surveys 表加 cron 列，支持定时自动同步飞书 Bitable
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS cron text NOT NULL DEFAULT '';
