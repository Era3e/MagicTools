CREATE OR REPLACE FUNCTION assistant_message_fingerprint(p_message text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT md5(
    lower(
      btrim(
        regexp_replace(
          translate(
            translate(
              p_message,
              'ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',
              'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
            ),
            '０１２３４５６７８９　（）：，。！？',
            '0123456789 ():,.!?'
          ),
          '\s+', ' ', 'g'
        )
      )
    )
  );
$$;

ALTER TABLE intent_logs ADD COLUMN IF NOT EXISTS message_fingerprint text;
UPDATE intent_logs SET message_fingerprint = assistant_message_fingerprint(message) WHERE message_fingerprint IS NULL;

CREATE OR REPLACE FUNCTION assistant_set_intent_log_fingerprint()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.message_fingerprint := assistant_message_fingerprint(NEW.message);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intent_logs_message_fingerprint ON intent_logs;
CREATE TRIGGER trg_intent_logs_message_fingerprint
BEFORE INSERT OR UPDATE OF message ON intent_logs
FOR EACH ROW EXECUTE FUNCTION assistant_set_intent_log_fingerprint();

CREATE INDEX IF NOT EXISTS idx_intent_logs_message_fingerprint ON intent_logs (message_fingerprint);

CREATE TABLE IF NOT EXISTS evaluation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_key text NOT NULL UNIQUE,
  case_type text NOT NULL CHECK (case_type IN ('routing', 'knowledge', 'action')),
  split text NOT NULL CHECK (split IN ('dev', 'regression', 'holdout')),
  message text NOT NULL,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  dataset_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluation_case_fingerprints (
  case_id uuid NOT NULL REFERENCES evaluation_cases(id) ON DELETE CASCADE,
  message_fingerprint text NOT NULL,
  PRIMARY KEY (case_id, message_fingerprint)
);

CREATE OR REPLACE FUNCTION assistant_sync_evaluation_fingerprints()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  step jsonb;
BEGIN
  DELETE FROM evaluation_case_fingerprints WHERE case_id = NEW.id;
  INSERT INTO evaluation_case_fingerprints (case_id, message_fingerprint)
  VALUES (NEW.id, assistant_message_fingerprint(NEW.message))
  ON CONFLICT DO NOTHING;
  FOR step IN SELECT * FROM jsonb_array_elements(NEW.history)
  LOOP
    IF step->>'role' = 'user' AND jsonb_typeof(step->'content') = 'string' THEN
      INSERT INTO evaluation_case_fingerprints (case_id, message_fingerprint)
      VALUES (NEW.id, assistant_message_fingerprint(step->>'content'))
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_evaluation_cases_fingerprints ON evaluation_cases;
CREATE TRIGGER trg_evaluation_cases_fingerprints
AFTER INSERT OR UPDATE OF message ON evaluation_cases
FOR EACH ROW EXECUTE FUNCTION assistant_sync_evaluation_fingerprints();

INSERT INTO evaluation_cases (case_key, case_type, split, message, expected) VALUES
('routing-dev-chitchat-hello', 'routing', 'dev', '你好，今天有什么能力', '{"domain":"chitchat","intent":"chitchat_reject"}'::jsonb),
('routing-dev-chitchat-thanks', 'routing', 'dev', '谢谢，再见', '{"domain":"chitchat","intent":"chitchat_reject"}'::jsonb),
('routing-dev-product-features', 'routing', 'dev', 'MagicTools 有哪些功能', '{"domain":"magictools","intent":"product_inquiry"}'::jsonb),
('routing-dev-product-scope', 'routing', 'dev', '知识库条目怎样圈定给助手', '{"domain":"magictools","intent":"product_inquiry"}'::jsonb),
('routing-dev-data-sales-month', 'routing', 'dev', '查询本月销售额', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-dev-data-customers-week', 'routing', 'dev', '统计上周客户数', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-dev-data-order-object', 'routing', 'dev', '创建一个订单业务对象', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-dev-data-agent-permission', 'routing', 'dev', '帮我配置智能体权限', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-dev-process-export', 'routing', 'dev', '帮我创建一个需求：支持导出功能', '{"domain":"magictools","intent":"process_execution"}'::jsonb),
('routing-dev-process-search', 'routing', 'dev', '新建需求：优化知识搜索', '{"domain":"magictools","intent":"process_execution"}'::jsonb),
('routing-dev-process-collect', 'routing', 'dev', '触发信息源 src-001 的采集', '{"domain":"magictools","intent":"process_execution"}'::jsonb),
('routing-dev-trouble-500', 'routing', 'dev', '服务报错 500 了，帮我排查', '{"domain":"magictools","intent":"trouble_shooting"}'::jsonb),
('routing-dev-trouble-boot', 'routing', 'dev', '系统起不来，怎么排查', '{"domain":"magictools","intent":"trouble_shooting"}'::jsonb),
('routing-dev-feedback-complaint', 'routing', 'dev', '我要投诉这个功能不好用', '{"domain":"magictools","intent":"complaint_feedback"}'::jsonb),
('routing-dev-feedback-export', 'routing', 'dev', '反馈一个问题：导出失败', '{"domain":"magictools","intent":"complaint_feedback"}'::jsonb),
('routing-dev-data-plugin-page', 'routing', 'dev', '打开插件管理页面', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-dev-data-unique-field', 'routing', 'dev', '字段唯一索引怎么配置', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-dev-data-report-requirements', 'routing', 'dev', '查询报表中未完成需求数量', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-regression-chitchat-english', 'routing', 'regression', 'hello world', '{"domain":"chitchat","intent":"chitchat_reject"}'::jsonb),
('routing-regression-data-report-spacing', 'routing', 'regression', '报表 里 昨天 的 转化率', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-regression-data-order-field', 'routing', 'regression', '订单对象需要唯一字段', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-regression-process-evaluation', 'routing', 'regression', '新建 MagicTools 需求：评测中心', '{"domain":"magictools","intent":"process_execution"}'::jsonb),
('routing-regression-process-collect', 'routing', 'regression', '跑一次信息源 src-002 采集', '{"domain":"magictools","intent":"process_execution"}'::jsonb),
('routing-regression-trouble-api', 'routing', 'regression', '接口调用失败怎么排查', '{"domain":"magictools","intent":"trouble_shooting"}'::jsonb),
('routing-regression-feedback-blank', 'routing', 'regression', '页面空白可以反馈吗', '{"domain":"magictools","intent":"complaint_feedback"}'::jsonb),
('routing-regression-product-evaluation', 'routing', 'regression', 'MagicTools 的评测集怎么管理', '{"domain":"magictools","intent":"product_inquiry"}'::jsonb),
('routing-regression-product-search', 'routing', 'regression', '知识条目如何进入检索', '{"domain":"magictools","intent":"product_inquiry"}'::jsonb),
('routing-regression-data-agent-restart', 'routing', 'regression', '智能体配置改动后要重启吗', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-regression-data-tickets', 'routing', 'regression', '统计本季度工单量', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-regression-chitchat-bye', 'routing', 'regression', '拜拜', '{"domain":"chitchat","intent":"chitchat_reject"}'::jsonb),
('routing-holdout-chitchat-status', 'routing', 'holdout', 'hi，帮我看看系统状态', '{"domain":"chitchat","intent":"chitchat_reject"}'::jsonb),
('routing-holdout-data-object-recovery', 'routing', 'holdout', '数据对象字段被误删，怎么恢复', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('routing-holdout-product-new-requirement', 'routing', 'holdout', '帮我提一个新需求', '{"domain":"magictools","intent":"product_inquiry"}'::jsonb),
('routing-holdout-trouble-site', 'routing', 'holdout', '网站挂了', '{"domain":"magictools","intent":"trouble_shooting"}'::jsonb),
('routing-holdout-feedback-export-slow', 'routing', 'holdout', '吐槽一下导出慢', '{"domain":"magictools","intent":"complaint_feedback"}'::jsonb),
('routing-holdout-data-churn', 'routing', 'holdout', '查一下客户流失率', '{"domain":"cybercloud","intent":"data_query"}'::jsonb),
('knowledge-dev-before-release', 'knowledge', 'dev', '发布前应该确认哪些事项', '{"contains":["变更范围","回退方案"],"forbidden":[],"minCitations":1}'::jsonb),
('knowledge-dev-release-artifact', 'knowledge', 'dev', '发布中如何确认制品安全', '{"contains":["固定制品摘要","回执"],"forbidden":[],"minCitations":1}'::jsonb),
('knowledge-dev-after-release', 'knowledge', 'dev', '发布后要回读哪些内容', '{"contains":["健康","数据","关键用户路径"],"forbidden":[],"minCitations":1}'::jsonb),
('knowledge-regression-citation', 'knowledge', 'regression', '知识回答必须提供什么证据', '{"contains":["引用上下文"],"forbidden":[],"minCitations":1}'::jsonb),
('knowledge-regression-no-match', 'knowledge', 'regression', '没有相关知识时应该怎么回答', '{"contains":["未找到相关知识"],"forbidden":[],"minCitations":0}'::jsonb),
('knowledge-holdout-secret', 'knowledge', 'holdout', '回答里不能出现什么内容', '{"contains":[],"forbidden":["内部密钥","API Key"],"minCitations":0}'::jsonb),
('action-dev-collect-001', 'action', 'dev', '触发信息源 src-001 的采集', '{"action":"trigger_collect","params":{"sourceId":"src-001"}}'::jsonb),
('action-dev-create-export', 'action', 'dev', '帮我创建一个需求：支持导出功能', '{"action":"create_requirement","params":{"title":"支持导出功能"}}'::jsonb),
('action-dev-collect-002', 'action', 'dev', '跑一次信息源 src-002 采集', '{"action":"trigger_collect","params":{"sourceId":"src-002"}}'::jsonb),
('action-regression-collect', 'action', 'regression', '触发信息源 src-reg-1 的采集', '{"action":"trigger_collect","params":{"sourceId":"src-reg-1"}}'::jsonb),
('action-regression-create', 'action', 'regression', '创建需求：修复导出乱码', '{"action":"create_requirement","params":{"title":"修复导出乱码"}}'::jsonb),
('action-holdout-collect', 'action', 'holdout', '执行信息源 src-hold-9 的采集', '{"action":"trigger_collect","params":{"sourceId":"src-hold-9"}}'::jsonb)
ON CONFLICT (case_key) DO UPDATE SET
  case_type = EXCLUDED.case_type,
  split = EXCLUDED.split,
  message = EXCLUDED.message,
  expected = EXCLUDED.expected,
  enabled = true,
  dataset_version = EXCLUDED.dataset_version,
  updated_at = now();

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  split text NOT NULL,
  dataset_fingerprint text NOT NULL,
  config_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'interrupted')),
  expected_total integer NOT NULL,
  pass_count integer NOT NULL DEFAULT 0,
  fail_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  timeout_count integer NOT NULL DEFAULT 0,
  missing_count integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE evaluation_runs DROP CONSTRAINT IF EXISTS evaluation_runs_status_check;
ALTER TABLE evaluation_runs ADD CONSTRAINT evaluation_runs_status_check
  CHECK (status IN ('running', 'completed', 'failed', 'interrupted'));

UPDATE evaluation_runs
SET status = 'interrupted', error = '迁移时发现心跳过期的运行', finished_at = now()
WHERE status = 'running' AND heartbeat_at < now() - interval '15 minutes';

UPDATE evaluation_runs later
SET status = 'failed', error = '迁移时清理重复活动运行', finished_at = now()
WHERE later.status = 'running'
  AND later.id <> (
    SELECT min(id::text)::uuid FROM evaluation_runs WHERE status = 'running'
  );

CREATE TABLE IF NOT EXISTS evaluation_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
  case_id uuid NOT NULL,
  case_key text NOT NULL,
  case_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('pass', 'fail', 'error', 'timeout', 'missing')),
  latency_ms integer NOT NULL DEFAULT 0,
  actual jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, case_id)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_cases_split ON evaluation_cases (split, case_type);
CREATE INDEX IF NOT EXISTS idx_evaluation_case_fingerprints_hash ON evaluation_case_fingerprints (message_fingerprint);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_started ON evaluation_runs (started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluation_runs_single_active
  ON evaluation_runs ((1)) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_evaluation_run_items_run ON evaluation_run_items (run_id, case_key);
