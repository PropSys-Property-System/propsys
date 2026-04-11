import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

const shouldRun = process.env.VITEST_DB === '1';

if (!shouldRun) {
  describe('postgres integration (db-mode smoke)', () => {
    it('no se ejecuta sin VITEST_DB=1', () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe('postgres integration (db-mode smoke)', () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL no configurada');
    }

    const pool = new Pool({ connectionString });

    afterAll(async () => {
      await pool.end();
    });

    it('conecta y expone tablas base', async () => {
      const ping = await pool.query<{ now: string }>('select now()::text as now');
      expect(ping.rows[0]?.now).toBeTypeOf('string');

      const expectedTables = [
        'clients',
        'users',
        'buildings',
        'units',
        'common_areas',
        'user_building_assignments',
        'user_unit_assignments',
        'notices',
        'reservations',
        'incidents',
        'tasks',
        'checklist_templates',
        'checklist_executions',
        'evidence_attachments',
        'receipts',
        'auth_sessions',
        'audit_logs',
        'schema_migrations',
      ];

      const res = await pool.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])`,
        [expectedTables]
      );

      const present = new Set(res.rows.map((r) => r.table_name));
      const missing = expectedTables.filter((t) => !present.has(t));
      expect(missing).toEqual([]);
    });

    it('encuentra cuentas QA seed cuando se exige', async () => {
      if (process.env.VITEST_DB_EXPECT_SEEDS !== '1') return;

      const emails = [
        'manager@propsys.com',
        'manager.sur@propsys.com',
        'building.admin@propsys.com',
        'building.admin.qa@propsys.com',
        'owner@propsys.com',
        'tenant@propsys.com',
      ];

      const res = await pool.query<{ email: string }>('SELECT email FROM users WHERE email = ANY($1::text[])', [emails]);
      const present = new Set(res.rows.map((r) => r.email));
      const missing = emails.filter((e) => !present.has(e));
      expect(missing).toEqual([]);
    });
  });
}

