CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key        text        PRIMARY KEY,
  count      integer     NOT NULL,
  reset_at   timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_reset_at_idx
  ON rate_limit_buckets (reset_at);
