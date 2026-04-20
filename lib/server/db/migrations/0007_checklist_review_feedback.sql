ALTER TABLE checklist_executions
ADD COLUMN IF NOT EXISTS last_review_action text NULL,
ADD COLUMN IF NOT EXISTS review_comment text NULL,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS reviewed_by_user_id text NULL REFERENCES users(id);
