import argon2 from 'argon2';
import { getPool } from '@/lib/server/db/client';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { parseArgs } from 'node:util';

loadEnv({ path: path.join(process.cwd(), '.env.local') });
loadEnv({ path: path.join(process.cwd(), '.env') });

const DEMO_CLIENT_ID = 'client_demo';

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const res = await client.query('SELECT id FROM clients WHERE id = $1', [DEMO_CLIENT_ID]);
    if (res.rowCount && res.rowCount > 0) {
      throw new Error(
        `El cliente demo (${DEMO_CLIENT_ID}) ya existe en la base de datos. Por favor, ejecuta primero: npx tsx scripts/cleanup-demo-beta.ts`
      );
    }

    console.log('Generando hash seguro para usuarios demo...');
    const demoPassword = 'DemoBeta2026';
    const passwordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });

    await client.query('BEGIN');

    // 1. Cliente
    console.log('Creando cliente demo...');
    await client.query(
      `INSERT INTO clients (id, slug, name, status) VALUES ($1, 'residencial-demo', 'Residencial Demo Los Álamos', 'ACTIVE')`,
      [DEMO_CLIENT_ID]
    );

    // 2. Usuarios
    console.log('Creando usuarios demo...');
    const users = [
      ['u_demo_mgr', 'manager.demo@propsys.local', 'Mariana Torres', 'MANAGER', 'CLIENT_MANAGER', 'client', 'ACTIVE'],
      ['u_demo_admin', 'admin.edificio.demo@propsys.local', 'Carlos Rivas', 'BUILDING_ADMIN', 'BUILDING_ADMIN', 'client', 'ACTIVE'],
      ['u_demo_staff', 'staff.demo@propsys.local', 'Luis Pérez', 'STAFF', 'STAFF', 'client', 'ACTIVE'],
      ['u_demo_owner', 'owner.demo@propsys.local', 'Ana Gómez', 'OWNER', 'OWNER', 'client', 'ACTIVE'],
      ['u_demo_tenant', 'tenant.demo@propsys.local', 'Rodrigo Salas', 'TENANT', 'OCCUPANT', 'client', 'ACTIVE'],
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, client_id, email, password_hash, name, role, internal_role, scope, status, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())`,
        [u[0], DEMO_CLIENT_ID, u[1], passwordHash, u[2], u[3], u[4], u[5], u[6]]
      );
    }

    // 3. Edificios
    console.log('Creando edificios demo...');
    await client.query(
      `INSERT INTO buildings (id, client_id, name, address, city, status, created_at, updated_at) VALUES 
       ('b_demo_A', $1, 'Torre A', 'Av. Álamos 100', 'Ciudad Demo', 'ACTIVE', now(), now()),
       ('b_demo_B', $1, 'Torre B', 'Av. Álamos 100', 'Ciudad Demo', 'ACTIVE', now(), now())`,
      [DEMO_CLIENT_ID]
    );

    // 4. Unidades
    console.log('Creando unidades demo...');
    await client.query(
      `INSERT INTO units (id, client_id, building_id, number, floor, status, created_at, updated_at) VALUES 
       ('u_demo_A101', $1, 'b_demo_A', '101', '1', 'ACTIVE', now(), now()),
       ('u_demo_A102', $1, 'b_demo_A', '102', '1', 'ACTIVE', now(), now()),
       ('u_demo_A201', $1, 'b_demo_A', '201', '2', 'ACTIVE', now(), now()),
       ('u_demo_B101', $1, 'b_demo_B', '101', '1', 'ACTIVE', now(), now()),
       ('u_demo_B102', $1, 'b_demo_B', '102', '1', 'ACTIVE', now(), now())`,
      [DEMO_CLIENT_ID]
    );

    // 5. Asignaciones de Edificio (BUILDING_ADMIN y STAFF)
    console.log('Asignando staff y admins a edificios...');
    await client.query(
      `INSERT INTO user_building_assignments (id, client_id, user_id, building_id, status, created_at, updated_at) VALUES
       ('uba_demo_1', $1, 'u_demo_admin', 'b_demo_A', 'ACTIVE', now(), now()),
       ('uba_demo_2', $1, 'u_demo_staff', 'b_demo_A', 'ACTIVE', now(), now()),
       ('uba_demo_3', $1, 'u_demo_staff', 'b_demo_B', 'ACTIVE', now(), now())`,
      [DEMO_CLIENT_ID]
    );

    // 6. Asignaciones de Unidad (OWNER y TENANT)
    console.log('Asignando residentes a unidades...');
    await client.query(
      `INSERT INTO user_unit_assignments (id, client_id, user_id, unit_id, assignment_type, status, created_at, updated_at) VALUES
       ('uua_demo_1', $1, 'u_demo_owner', 'u_demo_A101', 'OWNER', 'ACTIVE', now(), now()),
       ('uua_demo_2', $1, 'u_demo_owner', 'u_demo_B101', 'OWNER', 'ACTIVE', now(), now()),
       ('uua_demo_3', $1, 'u_demo_tenant', 'u_demo_A102', 'OCCUPANT', 'ACTIVE', now(), now())`,
      [DEMO_CLIENT_ID]
    );

    // 7. Recibos Demo
    console.log('Creando recibos demo...');
    // Enero A101 (PENDING)
    // Diciembre A101 (PAID)
    // Extraordinaria A102 (PENDING)
    await client.query(
      `INSERT INTO receipts (id, client_id, building_id, unit_id, number, description, amount, currency, issue_date, due_date, status, created_at, updated_at) VALUES
       ('rcpt_demo_1', $1, 'b_demo_A', 'u_demo_A101', 'RC-2026-0001', 'Mantenimiento Enero', 1500.00, 'PEN', '2026-01-01', '2026-01-10', 'PENDING', now(), now()),
       ('rcpt_demo_2', $1, 'b_demo_A', 'u_demo_A101', 'RC-2025-0012', 'Mantenimiento Diciembre', 1500.00, 'PEN', '2025-12-01', '2025-12-10', 'PAID', now(), now()),
       ('rcpt_demo_3', $1, 'b_demo_A', 'u_demo_A102', 'RC-2026-EXT1', 'Cuota Extraordinaria Pintura', 2500.00, 'PEN', '2026-02-01', '2026-02-15', 'PENDING', now(), now())`,
      [DEMO_CLIENT_ID]
    );

    // 8. Avisos Demo
    console.log('Creando avisos demo...');
    await client.query(
      `INSERT INTO notices (id, client_id, audience, building_id, title, body, status, created_by_user_id, published_at, created_at, updated_at) VALUES
       ('notc_demo_1', $1, 'ALL_BUILDINGS', NULL, 'Corte de agua programado', 'Estimados residentes, habrá un corte general de agua este sábado de 10am a 2pm.', 'PUBLISHED', 'u_demo_mgr', now(), now(), now()),
       ('notc_demo_2', $1, 'ALL_BUILDINGS', NULL, 'Asamblea mensual de propietarios', 'Se convoca a todos los propietarios a la asamblea del mes en curso.', 'PUBLISHED', 'u_demo_mgr', now(), now(), now())`,
      [DEMO_CLIENT_ID]
    );

    // 9. Áreas comunes y Reservas
    console.log('Creando áreas comunes y reservas demo...');
    await client.query(
      `INSERT INTO common_areas (id, client_id, building_id, name, capacity, requires_approval, status, created_at, updated_at) VALUES
       ('ca_demo_1', $1, 'b_demo_A', 'Sala de reuniones', 15, true, 'ACTIVE', now(), now()),
       ('ca_demo_2', $1, 'b_demo_A', 'Terraza / Parrilla', 25, true, 'ACTIVE', now(), now()),
       ('ca_demo_3', $1, 'b_demo_B', 'Salón social', 30, true, 'ACTIVE', now(), now())`,
      [DEMO_CLIENT_ID]
    );

    await client.query(
      `WITH demo_week AS (
         SELECT date_trunc('week', now()) + interval '1 week' AS week_start
       )
       INSERT INTO reservations (id, client_id, building_id, unit_id, common_area_id, created_by_user_id, start_at, end_at, status, cancelled_at, created_at, updated_at)
       SELECT 'resv_demo_1', $1, 'b_demo_A', 'u_demo_A101', 'ca_demo_2', 'u_demo_owner', week_start + interval '10 hours', week_start + interval '12 hours', 'APPROVED', NULL, now(), now() FROM demo_week
       UNION ALL
       SELECT 'resv_demo_2', $1, 'b_demo_A', 'u_demo_A102', 'ca_demo_2', 'u_demo_tenant', week_start + interval '1 day 18 hours', week_start + interval '1 day 20 hours', 'APPROVED', NULL, now(), now() FROM demo_week
       UNION ALL
       SELECT 'resv_demo_3', $1, 'b_demo_A', 'u_demo_A102', 'ca_demo_2', 'u_demo_tenant', week_start + interval '2 days 10 hours', week_start + interval '2 days 12 hours', 'CANCELLED', now(), now(), now() FROM demo_week
       UNION ALL
       SELECT 'resv_demo_4', $1, 'b_demo_A', 'u_demo_A102', 'ca_demo_2', 'u_demo_tenant', week_start + interval '3 days 10 hours', week_start + interval '3 days 12 hours', 'REJECTED', NULL, now(), now() FROM demo_week
       UNION ALL
       SELECT 'resv_demo_5', $1, 'b_demo_B', 'u_demo_B101', 'ca_demo_3', 'u_demo_owner', week_start + interval '4 days 16 hours', week_start + interval '4 days 18 hours', 'APPROVED', NULL, now(), now() FROM demo_week
       UNION ALL
       SELECT 'resv_demo_6', $1, 'b_demo_A', 'u_demo_A102', 'ca_demo_1', 'u_demo_tenant', week_start + interval '5 days 11 hours', week_start + interval '5 days 13 hours', 'REQUESTED', NULL, now(), now() FROM demo_week`,
      [DEMO_CLIENT_ID]
    );

    // 10. Operación (Tickets y Tareas)
    console.log('Creando tareas e incidencias demo...');
    await client.query(
      `INSERT INTO tasks (id, client_id, building_id, assigned_to_user_id, created_by_user_id, title, description, status, created_at, updated_at) VALUES
       ('task_demo_1', $1, 'b_demo_A', 'u_demo_staff', 'u_demo_admin', 'Revisar luminarias del lobby', 'Se requiere revisión completa de focos en lobby principal de Torre A.', 'PENDING', now(), now())`,
      [DEMO_CLIENT_ID]
    );

    await client.query(
      `INSERT INTO incidents (id, client_id, building_id, unit_id, title, description, status, priority, reported_by_user_id, assigned_to_user_id, created_at, updated_at) VALUES
       ('inc_demo_1', $1, 'b_demo_A', NULL, 'Fuga de agua en Torre A', 'Hay una pequeña fuga en la tubería del pasillo de acceso.', 'REPORTED', 'HIGH', 'u_demo_tenant', 'u_demo_staff', now(), now())`,
      [DEMO_CLIENT_ID]
    );

    await client.query('COMMIT');
    console.log('Dataset de demo creado exitosamente en BD.');

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error durante la creación del seed, se hizo ROLLBACK:', e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
