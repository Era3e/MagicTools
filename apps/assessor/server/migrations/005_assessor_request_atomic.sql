ALTER TABLE analysis_requests ADD COLUMN IF NOT EXISTS source_key text;

-- 存量请求以自身 id 作为不可变历史键，避免猜测来源归属；新写入由服务层提供稳定键。
UPDATE analysis_requests
SET source_key = 'legacy:' || id
WHERE source_key IS NULL OR source_key = '';

ALTER TABLE analysis_requests ALTER COLUMN source_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_requests_source_key
  ON analysis_requests (source_key);
