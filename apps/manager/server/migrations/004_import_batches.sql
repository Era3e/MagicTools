CREATE TABLE manager_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'previewed' CHECK (status IN ('previewed', 'confirmed')),
  revision integer NOT NULL DEFAULT 1,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
