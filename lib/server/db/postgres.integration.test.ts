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
        'receipt_payment_proofs',
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

    it('expone constraints e indices criticos de comprobantes de pago', async () => {
      const constraints = await pool.query<{ conname: string; contype: string }>(
        `SELECT conname, contype
         FROM pg_constraint
         WHERE conrelid = 'receipt_payment_proofs'::regclass
           AND conname = ANY($1::text[])`,
        [
          [
            'receipt_payment_proofs_status_check',
            'receipt_payment_proofs_client_fk',
            'receipt_payment_proofs_building_fk',
            'receipt_payment_proofs_unit_fk',
            'receipt_payment_proofs_receipt_fk',
            'receipt_payment_proofs_uploaded_by_fk',
            'receipt_payment_proofs_reviewed_by_fk',
          ],
        ]
      );

      const constraintNames = new Set(constraints.rows.map((row) => row.conname));
      expect(constraintNames).toEqual(
        new Set([
          'receipt_payment_proofs_status_check',
          'receipt_payment_proofs_client_fk',
          'receipt_payment_proofs_building_fk',
          'receipt_payment_proofs_unit_fk',
          'receipt_payment_proofs_receipt_fk',
          'receipt_payment_proofs_uploaded_by_fk',
          'receipt_payment_proofs_reviewed_by_fk',
        ])
      );

      const indexes = await pool.query<{ indexname: string }>(
        `SELECT indexname
         FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'receipt_payment_proofs'
           AND indexname = ANY($1::text[])`,
        [
          [
            'receipt_payment_proofs_client_building_created_idx',
            'receipt_payment_proofs_receipt_idx',
            'receipt_payment_proofs_uploaded_by_idx',
            'receipt_payment_proofs_receipt_active_unique',
          ],
        ]
      );

      const indexNames = new Set(indexes.rows.map((row) => row.indexname));
      expect(indexNames).toEqual(
        new Set([
          'receipt_payment_proofs_client_building_created_idx',
          'receipt_payment_proofs_receipt_idx',
          'receipt_payment_proofs_uploaded_by_idx',
          'receipt_payment_proofs_receipt_active_unique',
        ])
      );
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

