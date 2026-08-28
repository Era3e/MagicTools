-- D-06: Obsidian 同步冲突检测 + 手动解决
-- 为 entries 添加内容哈希，用于检测数据库与 Obsidian 文件的差异
ALTER TABLE entries ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE entries ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'synced';
ALTER TABLE entries ADD COLUMN IF NOT EXISTS obsidian_pending_content text;

-- sync_status: synced / conflicted
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_sync_status_check;
ALTER TABLE entries ADD CONSTRAINT entries_sync_status_check CHECK (sync_status IN ('synced','conflicted'));
