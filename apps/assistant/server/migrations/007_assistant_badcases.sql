ALTER TABLE intent_logs
  ADD COLUMN IF NOT EXISTS suggested_intent text,
  ADD COLUMN IF NOT EXISTS suggested_source text,
  ADD COLUMN IF NOT EXISTS correction_source text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS trace_id uuid,
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS user_message_id uuid;

ALTER TABLE intent_logs DROP CONSTRAINT IF EXISTS intent_logs_suggested_source_check;
ALTER TABLE intent_logs ADD CONSTRAINT intent_logs_suggested_source_check
  CHECK (suggested_source IS NULL OR suggested_source IN ('user_clarify'));
ALTER TABLE intent_logs DROP CONSTRAINT IF EXISTS intent_logs_correction_source_check;
ALTER TABLE intent_logs ADD CONSTRAINT intent_logs_correction_source_check
  CHECK (correction_source IS NULL OR correction_source IN ('admin'));

CREATE TABLE IF NOT EXISTS assistant_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_message_id uuid NOT NULL,
  assistant_message_id uuid,
  intent_log_id uuid,
  stage text NOT NULL CHECK (stage IN ('routing','knowledge','action','data','trouble','feedback','other')),
  status text NOT NULL CHECK (status IN ('running','completed','failed','clarifying')),
  route jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  latency_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_traces_conversation ON assistant_traces (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_traces_intent_log ON assistant_traces (intent_log_id);

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS user_message_id uuid,
  ADD COLUMN IF NOT EXISTS intent_log_id uuid,
  ADD COLUMN IF NOT EXISTS trace_id uuid;

ALTER TABLE evaluation_cases
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS manager_requirement_id text;

DROP TRIGGER IF EXISTS trg_evaluation_cases_fingerprints ON evaluation_cases;
CREATE TRIGGER trg_evaluation_cases_fingerprints
AFTER INSERT OR UPDATE OF message, history ON evaluation_cases
FOR EACH ROW EXECUTE FUNCTION assistant_sync_evaluation_fingerprints();

CREATE TABLE IF NOT EXISTS assistant_badcases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('user_feedback','user_clarify','admin_review','evaluation')),
  stage text NOT NULL CHECK (stage IN ('routing','knowledge','action','data','safety','other')),
  status text NOT NULL CHECK (status IN ('new','confirmed','classified','regression_ready','fix_planned','fix_merged','regression_passed','closed','rejected','duplicate')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected jsonb,
  trace_id uuid,
  conversation_id uuid,
  user_message_id uuid,
  assistant_message_id uuid,
  intent_log_id uuid,
  feedback_id uuid,
  evaluation_run_id uuid,
  evaluation_run_item_id uuid,
  evaluation_case_id uuid,
  baseline_run_id uuid,
  verification_run_id uuid,
  requirement_id text,
  requirement_url text NOT NULL DEFAULT '',
  fix_pr_url text NOT NULL DEFAULT '',
  closed_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_assistant_badcases_intent_log
  ON assistant_badcases (intent_log_id) WHERE source = 'user_clarify' AND intent_log_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assistant_badcases_status ON assistant_badcases (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_badcases_case ON assistant_badcases (evaluation_case_id);
