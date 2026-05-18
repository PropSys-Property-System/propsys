import { getPool } from '@/lib/server/db/client';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { parseArgs } from 'node:util';

loadEnv({ path: path.join(process.cwd(), '.env.local') });
loadEnv({ path: path.join(process.cwd(), '.env') });

const DEMO_CLIENT_ID = 'client_demo';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'include-storage': {
        type: 'boolean',
      },
    },
  });

  const pool = getPool();
  const client = await pool.connect();

  try {
    // 1. Verificar que no se esté intentando borrar a un cliente distinto
    // En este caso, el borrado está fuertemente acoplado a client_demo por seguridad.
    console.log(`Iniciando limpieza del cliente demo: ${DEMO_CLIENT_ID}`);

    await client.query('BEGIN');

    // 2. Romper ciclos FK (si aplican)
    console.log('Rompiendo ciclos FK potenciales...');
    try {
      await client.query('UPDATE tasks SET checklist_template_id = NULL WHERE client_id = $1', [DEMO_CLIENT_ID]);
    } catch { /* Ignorar si la columna no existe */ }
    try {
      await client.query('UPDATE checklist_templates SET task_id = NULL WHERE client_id = $1', [DEMO_CLIENT_ID]);
    } catch { /* Ignorar si la columna no existe */ }

    // 3. Ejecutar limpieza en orden FK-safe
    console.log('Eliminando registros de auth_sessions...');
    await client.query(
      'DELETE FROM auth_sessions WHERE client_id = $1 OR user_id IN (SELECT id FROM users WHERE client_id = $1)',
      [DEMO_CLIENT_ID]
    );

    console.log('Eliminando registros de audit_logs...');
    await client.query('DELETE FROM audit_logs WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de receipt_payment_proofs...');
    await client.query('DELETE FROM receipt_payment_proofs WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de receipts...');
    await client.query('DELETE FROM receipts WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de reservations...');
    await client.query('DELETE FROM reservations WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de checklist_executions...');
    await client.query('DELETE FROM checklist_executions WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de evidence_attachments...');
    await client.query('DELETE FROM evidence_attachments WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de incidents...');
    await client.query('DELETE FROM incidents WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de checklist_templates...');
    await client.query('DELETE FROM checklist_templates WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de tasks...');
    await client.query('DELETE FROM tasks WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de common_areas...');
    await client.query('DELETE FROM common_areas WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de notices...');
    await client.query('DELETE FROM notices WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de user_unit_assignments...');
    await client.query('DELETE FROM user_unit_assignments WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de user_building_assignments...');
    await client.query('DELETE FROM user_building_assignments WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de password_reset_tokens...');
    await client.query(
      'DELETE FROM password_reset_tokens WHERE client_id = $1 OR user_id IN (SELECT id FROM users WHERE client_id = $1)',
      [DEMO_CLIENT_ID]
    );

    console.log('Eliminando registros de user_invitations...');
    await client.query(
      'DELETE FROM user_invitations WHERE client_id = $1 OR user_id IN (SELECT id FROM users WHERE client_id = $1)',
      [DEMO_CLIENT_ID]
    );

    console.log('Eliminando registros de users...');
    await client.query('DELETE FROM users WHERE client_id = $1 AND email != $2', [DEMO_CLIENT_ID, 'root@propsys.com']);

    console.log('Eliminando registros de units...');
    await client.query('DELETE FROM units WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de buildings...');
    await client.query('DELETE FROM buildings WHERE client_id = $1', [DEMO_CLIENT_ID]);

    console.log('Eliminando registros de clients...');
    await client.query('DELETE FROM clients WHERE id = $1', [DEMO_CLIENT_ID]);

    await client.query('COMMIT');
    console.log('Limpieza en BD completada con éxito.');

    if (values['include-storage']) {
      console.warn('\\n[ADVERTENCIA] --include-storage detectado.');
      console.warn('El borrado de Supabase Storage no está automatizado por defecto en este script para prevenir borrados masivos.');
      console.warn('Por favor, borra manualmente los archivos bajo el prefijo "client_demo" en el panel de Supabase.');
    }

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error durante la limpieza, se hizo ROLLBACK:', e);
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
