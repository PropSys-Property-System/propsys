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
        'user_invitations',
        'password_reset_tokens',
        'rate_limit_buckets',
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

    it('expone foundation de onboarding tokens', async () => {
      const passwordHashColumn = await pool.query<{ is_nullable: string }>(
        `SELECT is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'users'
           AND column_name = 'password_hash'`
      );
      expect(passwordHashColumn.rows[0]?.is_nullable).toBe('YES');

      const constraints = await pool.query<{ conname: string; contype: string }>(
        `SELECT conname, contype
         FROM pg_constraint
         WHERE conrelid IN ('user_invitations'::regclass, 'password_reset_tokens'::regclass)
           AND conname = ANY($1::text[])`,
        [
          [
            'user_invitations_token_hash_unique',
            'user_invitations_status_check',
            'user_invitations_client_fk',
            'user_invitations_user_fk',
            'user_invitations_invited_by_fk',
            'password_reset_tokens_token_hash_unique',
            'password_reset_tokens_client_fk',
            'password_reset_tokens_user_fk',
          ],
        ]
      );

      const constraintNames = new Set(constraints.rows.map((row) => row.conname));
      expect(constraintNames).toEqual(
        new Set([
          'user_invitations_token_hash_unique',
          'user_invitations_status_check',
          'user_invitations_client_fk',
          'user_invitations_user_fk',
          'user_invitations_invited_by_fk',
          'password_reset_tokens_token_hash_unique',
          'password_reset_tokens_client_fk',
          'password_reset_tokens_user_fk',
        ])
      );

      const indexes = await pool.query<{ indexname: string }>(
        `SELECT indexname
         FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = ANY($1::text[])
           AND indexname = ANY($2::text[])`,
        [
          ['user_invitations', 'password_reset_tokens'],
          [
            'user_invitations_user_idx',
            'user_invitations_client_status_idx',
            'user_invitations_email_idx',
            'password_reset_tokens_user_idx',
            'password_reset_tokens_email_created_idx',
            'password_reset_tokens_active_idx',
          ],
        ]
      );

      const indexNames = new Set(indexes.rows.map((row) => row.indexname));
      expect(indexNames).toEqual(
        new Set([
          'user_invitations_user_idx',
          'user_invitations_client_status_idx',
          'user_invitations_email_idx',
          'password_reset_tokens_user_idx',
          'password_reset_tokens_email_created_idx',
          'password_reset_tokens_active_idx',
        ])
      );
    });

    it('expone RLS habilitado en tablas public protegidas', async () => {
      const expectedRlsTables = [
        'auth_sessions',
        'audit_logs',
        'buildings',
        'checklist_executions',
        'checklist_templates',
        'clients',
        'common_areas',
        'incidents',
        'evidence_attachments',
        'password_reset_tokens',
        'receipt_payment_proofs',
        'user_building_assignments',
        'schema_migrations',
        'units',
        'reservations',
        'tasks',
        'user_invitations',
        'user_unit_assignments',
        'users',
        'notices',
        'receipts',
        'rate_limit_buckets',
      ];

      const rls = await pool.query<{
        table_name: string;
        rls_enabled: boolean;
        force_rls: boolean;
      }>(
        `SELECT c.relname as table_name,
                c.relrowsecurity as rls_enabled,
                c.relforcerowsecurity as force_rls
         FROM pg_class c
         WHERE c.relnamespace = 'public'::regnamespace
           AND c.relkind IN ('r', 'p')
           AND c.relname = ANY($1::text[])`,
        [expectedRlsTables]
      );

      const byTable = new Map(rls.rows.map((row) => [row.table_name, row]));
      const missing = expectedRlsTables.filter((table) => !byTable.has(table));
      const rlsDisabled = rls.rows.filter((row) => !row.rls_enabled).map((row) => row.table_name);
      const forceEnabled = rls.rows.filter((row) => row.force_rls).map((row) => row.table_name);

      expect(missing).toEqual([]);
      expect(rlsDisabled).toEqual([]);
      expect(forceEnabled).toEqual([]);
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

