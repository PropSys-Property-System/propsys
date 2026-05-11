CREATE TABLE IF NOT EXISTS receipt_payment_proofs (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  building_id text NOT NULL,
  unit_id text NOT NULL,
  receipt_id text NOT NULL,
  uploaded_by_user_id text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  note text,
  status text NOT NULL,
  reviewed_by_user_id text,
  reviewed_at timestamptz,
  review_comment text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS receipt_payment_proofs_client_building_created_idx
  ON receipt_payment_proofs(client_id, building_id, created_at DESC);

CREATE INDEX IF NOT EXISTS receipt_payment_proofs_receipt_idx
  ON receipt_payment_proofs(receipt_id);

CREATE INDEX IF NOT EXISTS receipt_payment_proofs_uploaded_by_idx
  ON receipt_payment_proofs(uploaded_by_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS receipt_payment_proofs_receipt_active_unique
  ON receipt_payment_proofs(receipt_id)
  WHERE deleted_at IS NULL AND status IN ('PENDING_REVIEW', 'APPROVED');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_proofs_status_check'
  ) THEN
    ALTER TABLE receipt_payment_proofs
      ADD CONSTRAINT receipt_payment_proofs_status_check
      CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_proofs_client_fk'
  ) THEN
    ALTER TABLE receipt_payment_proofs
      ADD CONSTRAINT receipt_payment_proofs_client_fk
      FOREIGN KEY (client_id) REFERENCES clients(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_proofs_building_fk'
  ) THEN
    ALTER TABLE receipt_payment_proofs
      ADD CONSTRAINT receipt_payment_proofs_building_fk
      FOREIGN KEY (building_id) REFERENCES buildings(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_proofs_unit_fk'
  ) THEN
    ALTER TABLE receipt_payment_proofs
      ADD CONSTRAINT receipt_payment_proofs_unit_fk
      FOREIGN KEY (unit_id) REFERENCES units(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_proofs_receipt_fk'
  ) THEN
    ALTER TABLE receipt_payment_proofs
      ADD CONSTRAINT receipt_payment_proofs_receipt_fk
      FOREIGN KEY (receipt_id) REFERENCES receipts(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_proofs_uploaded_by_fk'
  ) THEN
    ALTER TABLE receipt_payment_proofs
      ADD CONSTRAINT receipt_payment_proofs_uploaded_by_fk
      FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'receipt_payment_proofs_reviewed_by_fk'
  ) THEN
    ALTER TABLE receipt_payment_proofs
      ADD CONSTRAINT receipt_payment_proofs_reviewed_by_fk
      FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id);
  END IF;
END $$;
