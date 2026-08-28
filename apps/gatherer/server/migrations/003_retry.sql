-- D-12: 采集运行重试计数 + 死信标记
-- 允许采集失败后指数退避重试，达到上限后进入 dead 终态
ALTER TABLE runs ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'running';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS dead_at timestamptz;

-- status: running → success/dead
ALTER TABLE runs DROP CONSTRAINT IF EXISTS runs_status_check;
ALTER TABLE runs ADD CONSTRAINT runs_status_check CHECK (status IN ('running','success','dead'));
