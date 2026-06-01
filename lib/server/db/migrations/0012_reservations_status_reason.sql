ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_reason_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_reason_updated_by text;

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_status_reason_length_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_status_reason_length_check
  CHECK (
    status_reason IS NULL
    OR char_length(trim(status_reason)) BETWEEN 8 AND 300
  );
