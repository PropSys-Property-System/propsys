import argon2 from 'argon2';
import { getPool } from '@/lib/server/db/client';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.join(process.cwd(), '.env.local') });
loadEnv({ path: path.join(process.cwd(), '.env') });

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  const password = 'PropsysQA#2026';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM auth_sessions');
    await client.query('DELETE FROM audit_logs');
    await client.query('DELETE FROM receipts');
    await client.query('DELETE FROM reservations');
    await client.query('DELETE FROM notices');
    await client.query('DELETE FROM evidence_attachments');
    await client.query('DELETE FROM checklist_executions');
    await client.query('DELETE FROM tasks');
    await client.query('DELETE FROM checklist_templates');
    await client.query('DELETE FROM incidents');
    await client.query('DELETE FROM user_unit_assignments');
    await client.query('DELETE FROM user_building_assignments');
    await client.query('DELETE FROM common_areas');
    await client.query('DELETE FROM units');
    await client.query('DELETE FROM buildings');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM clients');

    await client.query(
      `INSERT INTO clients (id, slug, name, status)
       VALUES
         ('client_001', 'client_001', 'PropSys Administraciones Globales', 'ACTIVE'),
         ('client_002', 'client_002', 'Gestión Residencial Sur', 'ACTIVE')`
    );

    await client.query(
      `INSERT INTO users (id, client_id, email, password_hash, name, role, internal_role, scope, status)
       VALUES
         ('u1', 'client_001', 'manager@propsys.com', $1, 'Gestora Principal', 'MANAGER', 'CLIENT_MANAGER', 'client', 'ACTIVE'),
         ('u6', 'client_002', 'manager.sur@propsys.com', $1, 'Gerente Sur', 'MANAGER', 'CLIENT_MANAGER', 'client', 'ACTIVE'),
         ('u2', 'client_001', 'building.admin@propsys.com', $1, 'Administrador Edificio', 'BUILDING_ADMIN', 'BUILDING_ADMIN', 'client', 'ACTIVE'),
         ('u7', 'client_001', 'building.admin.qa@propsys.com', $1, 'Administrador (sin asignación)', 'BUILDING_ADMIN', 'BUILDING_ADMIN', 'client', 'ACTIVE'),
         ('u3', 'client_001', 'staff@propsys.com', $1, 'Staff Operativo', 'STAFF', 'STAFF', 'client', 'ACTIVE'),
         ('u4', 'client_001', 'owner@propsys.com', $1, 'Propietaria Carla', 'OWNER', 'OWNER', 'client', 'ACTIVE'),
         ('u5', 'client_001', 'tenant@propsys.com', $1, 'Inquilino Juan', 'TENANT', 'OCCUPANT', 'client', 'ACTIVE'),
         ('u8', 'client_002', 'building.admin.sur@propsys.com', $1, 'Administrador Sur', 'BUILDING_ADMIN', 'BUILDING_ADMIN', 'client', 'ACTIVE'),
         ('u9', 'client_002', 'staff.sur@propsys.com', $1, 'Staff Sur', 'STAFF', 'STAFF', 'client', 'ACTIVE'),
         ('u10', 'client_002', 'owner.sur@propsys.com', $1, 'Propietario Sur', 'OWNER', 'OWNER', 'client', 'ACTIVE'),
         ('u11', 'client_002', 'tenant.sur@propsys.com', $1, 'Residente Sur', 'TENANT', 'OCCUPANT', 'client', 'ACTIVE'),
         ('u12', 'client_001', 'inactive@propsys.com', $1, 'Usuario Inactivo', 'TENANT', 'OCCUPANT', 'client', 'SUSPENDED')`,
      [passwordHash]
    );

    await client.query(
      `INSERT INTO buildings (id, client_id, name, address, city, status)
       VALUES
         ('b1', 'client_001', 'Edificio Central', 'Av. Principal 123', 'Lima', 'ACTIVE'),
         ('b2', 'client_001', 'Torre Norte', 'Calle Norte 45', 'Lima', 'ACTIVE'),
         ('b3', 'client_002', 'Condominio Sur', 'Camino Sur 500', 'Arequipa', 'ACTIVE')`
    );

    await client.query(
      `INSERT INTO units (id, client_id, building_id, number, floor, status)
       VALUES
         ('unit-101', 'client_001', 'b1', '101', '1', 'ACTIVE'),
         ('unit-102', 'client_001', 'b1', '102', '1', 'ACTIVE'),
         ('unit-201', 'client_001', 'b2', '201', '2', 'ACTIVE'),
         ('unit-301', 'client_002', 'b3', '301', '3', 'ACTIVE')`
    );

    await client.query(
      `INSERT INTO user_building_assignments (id, client_id, user_id, building_id, status)
       VALUES
         ('uba-1', 'client_001', 'u2', 'b1', 'ACTIVE'),
         ('uba-1b', 'client_001', 'u2', 'b2', 'ACTIVE'),
         ('uba-2', 'client_001', 'u3', 'b1', 'ACTIVE'),
         ('uba-3', 'client_002', 'u8', 'b3', 'ACTIVE'),
         ('uba-4', 'client_002', 'u9', 'b3', 'ACTIVE')`
    );

    await client.query(
      `INSERT INTO user_unit_assignments (id, client_id, user_id, unit_id, assignment_type, status)
       VALUES
         ('uua-1', 'client_001', 'u4', 'unit-101', 'OWNER', 'ACTIVE'),
         ('uua-2b', 'client_001', 'u4', 'unit-201', 'OWNER', 'ACTIVE'),
         ('uua-3', 'client_001', 'u5', 'unit-102', 'OCCUPANT', 'ACTIVE'),
         ('uua-4', 'client_002', 'u10', 'unit-301', 'OWNER', 'ACTIVE'),
         ('uua-5', 'client_002', 'u11', 'unit-301', 'OCCUPANT', 'ACTIVE')`
    );

    await client.query(
      `INSERT INTO common_areas (id, client_id, building_id, name, capacity, requires_approval, status)
       VALUES
         ('ca1', 'client_001', 'b1', 'Sala Multiuso', 30, true, 'ACTIVE'),
         ('ca2', 'client_001', 'b1', 'Quincho', 12, false, 'ACTIVE'),
         ('ca3', 'client_001', 'b2', 'Gimnasio', 10, false, 'ACTIVE'),
         ('ca4', 'client_002', 'b3', 'Piscina', 20, true, 'ACTIVE')`
    );

    await client.query(
      `INSERT INTO notices (id, client_id, audience, building_id, title, body, status, created_by_user_id, published_at, created_at, updated_at)
       VALUES
         ('notice-1', 'client_001', 'ALL_BUILDINGS', NULL, 'Corte de agua programado', 'Habrá corte de agua el sábado de 10:00 a 14:00.', 'PUBLISHED', 'u1', now(), now(), now()),
         ('notice-2', 'client_001', 'BUILDING', 'b1', 'Mantención ascensor', 'Mantención preventiva del ascensor el jueves a las 09:00.', 'PUBLISHED', 'u2', now(), now(), now()),
         ('notice-3', 'client_002', 'BUILDING', 'b3', 'Limpieza piscina', 'La piscina estará cerrada por limpieza el domingo.', 'PUBLISHED', 'u6', now(), now(), now())`
    );

    await client.query(
      `INSERT INTO incidents (id, client_id, building_id, unit_id, title, description, status, priority, reported_by_user_id, assigned_to_user_id, created_at, updated_at)
       VALUES
         ('inc-qa-1', 'client_001', 'b1', 'unit-102', 'Fuga de agua en baño', 'Se detecta fuga en el baño principal.', 'REPORTED', 'HIGH', 'u5', NULL, now(), now()),
         ('inc-qa-2', 'client_001', 'b1', NULL, 'Luz pasillo apagada', 'Luminaria del piso 1 no enciende.', 'ASSIGNED', 'MEDIUM', 'u2', 'u3', now(), now()),
         ('inc-qa-3', 'client_002', 'b3', 'unit-301', 'Portón con falla', 'Portón principal demora al cerrar.', 'IN_PROGRESS', 'MEDIUM', 'u11', 'u9', now(), now())`
    );

    await client.query(
      `INSERT INTO tasks (id, client_id, building_id, assigned_to_user_id, created_by_user_id, title, description, status, created_at, updated_at)
       VALUES
         ('task-qa-1', 'client_001', 'b1', 'u3', 'u2', 'Ronda de seguridad (turno noche)', 'Completar ronda y registrar novedades.', 'PENDING', now(), now()),
         ('task-qa-2', 'client_001', 'b1', 'u3', 'u2', 'Revisión luminarias pasillo', 'Verificar luminarias del piso 1 y reportar fallas.', 'IN_PROGRESS', now(), now()),
         ('task-qa-3', 'client_002', 'b3', 'u9', 'u8', 'Chequeo de bombas', 'Revisar bombas de agua y registrar presión.', 'COMPLETED', now(), now())`
    );

    await client.query(
      `INSERT INTO checklist_templates (id, client_id, building_id, name, description, items, status, created_by_user_id, created_at, updated_at)
       VALUES
         ('chk-tpl-qa-b1', 'client_001', 'b1', 'Apertura Turno', 'Checklist base de apertura para staff.', '[{"id":"chk-i-1","label":"Revisar acceso principal","required":true},{"id":"chk-i-2","label":"Revisar cámaras","required":true},{"id":"chk-i-3","label":"Registrar novedades","required":false}]'::jsonb, 'ACTIVE', 'u2', now(), now()),
         ('chk-tpl-qa-b3', 'client_002', 'b3', 'Cierre Turno', 'Checklist base de cierre para staff.', '[{"id":"chk-i-10","label":"Verificar portón y accesos","required":true},{"id":"chk-i-11","label":"Registrar lecturas de presión","required":true}]'::jsonb, 'ACTIVE', 'u8', now(), now())`
    );

    await client.query(
      `INSERT INTO checklist_executions (id, client_id, building_id, unit_id, task_id, template_id, assigned_to_user_id, status, results, completed_at, approved_at, created_at, updated_at)
       VALUES
         ('chk-exec-qa-1', 'client_001', 'b1', NULL, 'task-qa-1', 'chk-tpl-qa-b1', 'u3', 'PENDING', '[]'::jsonb, NULL, NULL, now(), now()),
         ('chk-exec-qa-2', 'client_002', 'b3', NULL, 'task-qa-3', 'chk-tpl-qa-b3', 'u9', 'COMPLETED', '[{"itemId":"chk-i-10","value":true},{"itemId":"chk-i-11","value":true}]'::jsonb, now(), NULL, now(), now())`
    );

    await client.query(
      `INSERT INTO evidence_attachments (id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, url, uploaded_by_user_id, created_at)
       VALUES
         ('ev-qa-1', 'client_002', 'b3', NULL, NULL, 'task-qa-3', 'chk-exec-qa-2', 'lectura-presion.txt', 'text/uri-list', 'https://example.com/evidence/lectura-presion', 'u9', now())`
    );

    await client.query(
      `INSERT INTO reservations (id, client_id, building_id, unit_id, common_area_id, created_by_user_id, start_at, end_at, status, created_at, updated_at)
       VALUES
         ('resv-qa-1', 'client_001', 'b1', 'unit-102', 'ca2', 'u5', now() + interval '2 days', now() + interval '2 days' + interval '2 hours', 'APPROVED', now(), now()),
         ('resv-qa-2', 'client_001', 'b1', 'unit-101', 'ca1', 'u4', now() + interval '3 days', now() + interval '3 days' + interval '3 hours', 'REQUESTED', now(), now()),
         ('resv-qa-3', 'client_002', 'b3', 'unit-301', 'ca4', 'u11', now() + interval '1 day', now() + interval '1 day' + interval '1 hour', 'REQUESTED', now(), now())`
    );

    await client.query(
      `INSERT INTO receipts (id, client_id, building_id, unit_id, number, description, amount, currency, issue_date, due_date, status, created_at, updated_at)
       VALUES
         ('rcpt-qa-1', 'client_001', 'b1', 'unit-102', 'RC-2026-0001', 'Gastos comunes abril', 85000.00, 'PEN', '2026-04-01', '2026-04-10', 'PENDING', now(), now()),
         ('rcpt-qa-2', 'client_001', 'b1', 'unit-101', 'RC-2026-0002', 'Gastos comunes abril', 92000.00, 'PEN', '2026-04-01', '2026-04-10', 'PAID', now(), now()),
         ('rcpt-qa-3', 'client_002', 'b3', 'unit-301', 'RC-2026-1001', 'Gastos comunes abril', 78000.00, 'PEN', '2026-04-01', '2026-04-12', 'OVERDUE', now(), now())`
    );

    await client.query('COMMIT');
    // eslint-disable-next-line no-console
    console.log('Seed QA aplicado.');
    // eslint-disable-next-line no-console
    console.log(`Password QA: ${password}`);
    // eslint-disable-next-line no-console
    console.log(
      'Cuentas: manager@propsys.com, building.admin@propsys.com, building.admin.qa@propsys.com, staff@propsys.com, owner@propsys.com, tenant@propsys.com, manager.sur@propsys.com, building.admin.sur@propsys.com, staff.sur@propsys.com, owner.sur@propsys.com, tenant.sur@propsys.com, inactive@propsys.com'
    );
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
