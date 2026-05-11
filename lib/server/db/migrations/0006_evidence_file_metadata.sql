DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'evidence_attachments' AND column_name = 'size_bytes'
  ) THEN
    ALTER TABLE evidence_attachments ADD COLUMN size_bytes bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'evidence_attachments' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE evidence_attachments ADD COLUMN storage_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'evidence_attachments' AND column_name = 'public_path'
  ) THEN
    ALTER TABLE evidence_attachments ADD COLUMN public_path text;
  END IF;
END $$;

