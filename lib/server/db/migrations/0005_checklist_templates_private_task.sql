DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'checklist_templates' AND column_name = 'is_private'
  ) THEN
    ALTER TABLE checklist_templates
      ADD COLUMN is_private boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'checklist_templates' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE checklist_templates
      ADD COLUMN task_id text NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS checklist_templates_private_task_idx ON checklist_templates(is_private, task_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_templates_task_fk'
  ) THEN
    ALTER TABLE checklist_templates
      ADD CONSTRAINT checklist_templates_task_fk
      FOREIGN KEY (task_id) REFERENCES tasks(id);
  END IF;
END $$;

