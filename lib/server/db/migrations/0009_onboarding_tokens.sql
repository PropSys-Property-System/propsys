DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'password_hash'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_invitations (
  id text PRIMARY KEY,
  client_id text,
  user_id text NOT NULL,
  invited_by_user_id text,
  email text NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id text PRIMARY KEY,
  client_id text,
  user_id text NOT NULL,
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_invitations_user_idx
  ON user_invitations(user_id);

CREATE INDEX IF NOT EXISTS user_invitations_client_status_idx
  ON user_invitations(client_id, status, expires_at);

CREATE INDEX IF NOT EXISTS user_invitations_email_idx
  ON user_invitations(email);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS password_reset_tokens_email_created_idx
  ON password_reset_tokens(email, created_at DESC);

CREATE INDEX IF NOT EXISTS password_reset_tokens_active_idx
  ON password_reset_tokens(user_id, expires_at)
  WHERE used_at IS NULL AND revoked_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_token_hash_unique'
  ) THEN
    ALTER TABLE user_invitations
      ADD CONSTRAINT user_invitations_token_hash_unique
      UNIQUE (token_hash);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_status_check'
  ) THEN
    ALTER TABLE user_invitations
      ADD CONSTRAINT user_invitations_status_check
      CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_client_fk'
  ) THEN
    ALTER TABLE user_invitations
      ADD CONSTRAINT user_invitations_client_fk
      FOREIGN KEY (client_id) REFERENCES clients(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_user_fk'
  ) THEN
    ALTER TABLE user_invitations
      ADD CONSTRAINT user_invitations_user_fk
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_invitations_invited_by_fk'
  ) THEN
    ALTER TABLE user_invitations
      ADD CONSTRAINT user_invitations_invited_by_fk
      FOREIGN KEY (invited_by_user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_token_hash_unique'
  ) THEN
    ALTER TABLE password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_token_hash_unique
      UNIQUE (token_hash);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_client_fk'
  ) THEN
    ALTER TABLE password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_client_fk
      FOREIGN KEY (client_id) REFERENCES clients(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_user_fk'
  ) THEN
    ALTER TABLE password_reset_tokens
      ADD CONSTRAINT password_reset_tokens_user_fk
      FOREIGN KEY (user_id) REFERENCES users(id);
  END IF;
END $$;
