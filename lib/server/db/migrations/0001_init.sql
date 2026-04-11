CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clients (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id text PRIMARY KEY,
  client_id text NULL REFERENCES clients(id),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  internal_role text NOT NULL,
  scope text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE buildings (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  name text NOT NULL,
  address text,
  city text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX buildings_client_id_idx ON buildings(client_id);

CREATE TABLE units (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  building_id text NOT NULL REFERENCES buildings(id),
  number text NOT NULL,
  floor text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX units_client_building_idx ON units(client_id, building_id);

CREATE TABLE common_areas (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  building_id text NOT NULL REFERENCES buildings(id),
  name text NOT NULL,
  capacity int NOT NULL DEFAULT 1,
  requires_approval boolean NOT NULL DEFAULT true,
  status text NOT NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX common_areas_client_building_idx ON common_areas(client_id, building_id);

CREATE TABLE user_building_assignments (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  user_id text NOT NULL REFERENCES users(id),
  building_id text NOT NULL REFERENCES buildings(id),
  status text NOT NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX uba_client_building_idx ON user_building_assignments(client_id, building_id);

CREATE TABLE user_unit_assignments (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  user_id text NOT NULL REFERENCES users(id),
  unit_id text NOT NULL REFERENCES units(id),
  assignment_type text NOT NULL,
  status text NOT NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX uua_client_unit_idx ON user_unit_assignments(client_id, unit_id);

CREATE TABLE incidents (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  building_id text NOT NULL REFERENCES buildings(id),
  unit_id text NULL REFERENCES units(id),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL,
  priority text NOT NULL,
  reported_by_user_id text NOT NULL REFERENCES users(id),
  assigned_to_user_id text NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX incidents_client_building_idx ON incidents(client_id, building_id);

CREATE TABLE tasks (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  building_id text NOT NULL REFERENCES buildings(id),
  assigned_to_user_id text NOT NULL REFERENCES users(id),
  title text NOT NULL,
  description text,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tasks_client_building_idx ON tasks(client_id, building_id);

CREATE TABLE notices (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  audience text NOT NULL,
  building_id text NULL REFERENCES buildings(id),
  title text NOT NULL,
  body text NOT NULL,
  status text NOT NULL,
  created_by_user_id text NOT NULL REFERENCES users(id),
  published_at timestamptz NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notices_client_status_idx ON notices(client_id, status);

CREATE TABLE reservations (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  building_id text NOT NULL REFERENCES buildings(id),
  unit_id text NOT NULL REFERENCES units(id),
  common_area_id text NOT NULL REFERENCES common_areas(id),
  created_by_user_id text NOT NULL REFERENCES users(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL,
  cancelled_at timestamptz NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reservations_client_building_area_idx ON reservations(client_id, building_id, common_area_id, start_at);

CREATE TABLE receipts (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  building_id text NOT NULL REFERENCES buildings(id),
  unit_id text NOT NULL REFERENCES units(id),
  number text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX receipts_client_building_idx ON receipts(client_id, building_id);

CREATE TABLE audit_logs (
  id text PRIMARY KEY,
  client_id text NOT NULL REFERENCES clients(id),
  user_id text NOT NULL REFERENCES users(id),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb NULL,
  old_data jsonb NULL,
  new_data jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_client_created_idx ON audit_logs(client_id, created_at DESC);

CREATE TABLE auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  client_id text NULL REFERENCES clients(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL
);

CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_idx ON auth_sessions(expires_at);

