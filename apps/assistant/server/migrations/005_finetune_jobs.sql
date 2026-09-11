CREATE TABLE IF NOT EXISTS finetune_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remote_job_id text NOT NULL,
  remote_file_id text NOT NULL,
  base_model text NOT NULL,
  sample_count int NOT NULL,
  status text NOT NULL DEFAULT 'created',
  fine_tuned_model text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
