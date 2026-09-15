-- P21: 记录模型调用的真实执行身份、重试、取消和用量来源。
-- token 数允许 NULL：供应商未返回 usage 时必须显式 unknown，不能用片段数估算。
CREATE TABLE IF NOT EXISTS model_calls (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  service text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('chat', 'chat-stream', 'embedding')),
  provider text NOT NULL,
  requested_model text,
  effective_model text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'cancelled')),
  attempt integer NOT NULL CHECK (attempt > 0),
  attempts integer NOT NULL CHECK (attempts > 0),
  input_tokens integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
  token_source text NOT NULL CHECK (token_source IN ('provider', 'unknown')),
  latency_ms integer NOT NULL CHECK (latency_ms >= 0),
  task_id text,
  trace_id text,
  error_code text,
  error_message text,
  cancelled boolean NOT NULL DEFAULT false,
  context jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_model_calls_service_time ON model_calls (service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_calls_status_time ON model_calls (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_calls_task ON model_calls (task_id);
CREATE INDEX IF NOT EXISTS idx_model_calls_trace ON model_calls (trace_id);
