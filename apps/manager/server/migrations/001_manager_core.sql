CREATE TABLE IF NOT EXISTS requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  source_ref text NOT NULL DEFAULT '',
  source_payload jsonb,
  status text NOT NULL DEFAULT 'waiting',
  priority text NOT NULL DEFAULT 'P2',
  iteration_id uuid,
  branch text NOT NULL DEFAULT '',
  pr_url text NOT NULL DEFAULT '',
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT requirements_status_check CHECK (status IN ('waiting','designing','todo','developing','testing','accepting','done')),
  CONSTRAINT requirements_priority_check CHECK (priority IN ('P0','P1','P2')),
  CONSTRAINT requirements_source_check CHECK (source IN ('assessor','manual','github','cybercloud'))
);

CREATE TABLE IF NOT EXISTS iterations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE requirements ADD CONSTRAINT requirements_iteration_fk FOREIGN KEY (iteration_id) REFERENCES iterations(id) ON DELETE SET NULL;
