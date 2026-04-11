CREATE TABLE IF NOT EXISTS checklist_templates (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  building_id text NOT NULL,
  name text NOT NULL,
  description text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_by_user_id text NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checklist_templates_client_building_idx ON checklist_templates(client_id, building_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_templates_client_fk'
  ) THEN
    ALTER TABLE checklist_templates
      ADD CONSTRAINT checklist_templates_client_fk
      FOREIGN KEY (client_id) REFERENCES clients(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_templates_building_fk'
  ) THEN
    ALTER TABLE checklist_templates
      ADD CONSTRAINT checklist_templates_building_fk
      FOREIGN KEY (building_id) REFERENCES buildings(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_templates_created_by_fk'
  ) THEN
    ALTER TABLE checklist_templates
      ADD CONSTRAINT checklist_templates_created_by_fk
      FOREIGN KEY (created_by_user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS checklist_executions (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  building_id text NOT NULL,
  unit_id text,
  task_id text,
  template_id text NOT NULL,
  assigned_to_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  approved_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checklist_executions_client_building_idx ON checklist_executions(client_id, building_id);
CREATE INDEX IF NOT EXISTS checklist_executions_template_idx ON checklist_executions(template_id);
CREATE INDEX IF NOT EXISTS checklist_executions_task_idx ON checklist_executions(task_id);
CREATE INDEX IF NOT EXISTS checklist_executions_assignee_idx ON checklist_executions(assigned_to_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_executions_client_fk'
  ) THEN
    ALTER TABLE checklist_executions
      ADD CONSTRAINT checklist_executions_client_fk
      FOREIGN KEY (client_id) REFERENCES clients(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_executions_building_fk'
  ) THEN
    ALTER TABLE checklist_executions
      ADD CONSTRAINT checklist_executions_building_fk
      FOREIGN KEY (building_id) REFERENCES buildings(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_executions_unit_fk'
  ) THEN
    ALTER TABLE checklist_executions
      ADD CONSTRAINT checklist_executions_unit_fk
      FOREIGN KEY (unit_id) REFERENCES units(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_executions_task_fk'
  ) THEN
    ALTER TABLE checklist_executions
      ADD CONSTRAINT checklist_executions_task_fk
      FOREIGN KEY (task_id) REFERENCES tasks(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_executions_template_fk'
  ) THEN
    ALTER TABLE checklist_executions
      ADD CONSTRAINT checklist_executions_template_fk
      FOREIGN KEY (template_id) REFERENCES checklist_templates(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checklist_executions_assignee_fk'
  ) THEN
    ALTER TABLE checklist_executions
      ADD CONSTRAINT checklist_executions_assignee_fk
      FOREIGN KEY (assigned_to_user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS evidence_attachments (
  id text PRIMARY KEY,
  client_id text NOT NULL,
  building_id text NOT NULL,
  unit_id text,
  incident_id text,
  task_id text,
  checklist_execution_id text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  url text NOT NULL,
  uploaded_by_user_id text NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_attachments_client_building_idx ON evidence_attachments(client_id, building_id);
CREATE INDEX IF NOT EXISTS evidence_attachments_execution_idx ON evidence_attachments(checklist_execution_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_attachments_client_fk'
  ) THEN
    ALTER TABLE evidence_attachments
      ADD CONSTRAINT evidence_attachments_client_fk
      FOREIGN KEY (client_id) REFERENCES clients(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_attachments_building_fk'
  ) THEN
    ALTER TABLE evidence_attachments
      ADD CONSTRAINT evidence_attachments_building_fk
      FOREIGN KEY (building_id) REFERENCES buildings(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_attachments_unit_fk'
  ) THEN
    ALTER TABLE evidence_attachments
      ADD CONSTRAINT evidence_attachments_unit_fk
      FOREIGN KEY (unit_id) REFERENCES units(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_attachments_incident_fk'
  ) THEN
    ALTER TABLE evidence_attachments
      ADD CONSTRAINT evidence_attachments_incident_fk
      FOREIGN KEY (incident_id) REFERENCES incidents(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_attachments_task_fk'
  ) THEN
    ALTER TABLE evidence_attachments
      ADD CONSTRAINT evidence_attachments_task_fk
      FOREIGN KEY (task_id) REFERENCES tasks(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_attachments_execution_fk'
  ) THEN
    ALTER TABLE evidence_attachments
      ADD CONSTRAINT evidence_attachments_execution_fk
      FOREIGN KEY (checklist_execution_id) REFERENCES checklist_executions(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_attachments_uploaded_by_fk'
  ) THEN
    ALTER TABLE evidence_attachments
      ADD CONSTRAINT evidence_attachments_uploaded_by_fk
      FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id);
  END IF;
END $$;


