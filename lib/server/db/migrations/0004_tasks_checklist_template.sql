DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'created_by_user_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN created_by_user_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'checklist_template_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN checklist_template_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_created_by_fk'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_created_by_fk
      FOREIGN KEY (created_by_user_id) REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_checklist_template_fk'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_checklist_template_fk
      FOREIGN KEY (checklist_template_id) REFERENCES checklist_templates(id);
  END IF;
END $$;

