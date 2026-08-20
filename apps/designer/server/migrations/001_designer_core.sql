CREATE TABLE IF NOT EXISTS generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  component_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ok',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT generations_status_check CHECK (status IN ('ok','failed'))
);

CREATE TABLE IF NOT EXISTS components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  code text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT components_unique_name UNIQUE (name)
);
