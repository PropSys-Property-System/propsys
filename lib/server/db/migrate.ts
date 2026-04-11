import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { getPool } from './client';

loadEnv({ path: path.join(process.cwd(), '.env.local') });
loadEnv({ path: path.join(process.cwd(), '.env') });

async function ensureMigrationsTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function listApplied(): Promise<Set<string>> {
  const pool = getPool();
  const res = await pool.query<{ id: string }>('SELECT id FROM schema_migrations');
  return new Set(res.rows.map((r) => r.id));
}

async function applyMigration(id: string, sql: string) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  const migrationsDir = path.join(process.cwd(), 'lib', 'server', 'db', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`No existe el directorio de migraciones: ${migrationsDir}`);
  }

  await ensureMigrationsTable();
  const applied = await listApplied();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    if (applied.has(file)) continue;
    const full = path.join(migrationsDir, file);
    const sql = fs.readFileSync(full, 'utf8');
    await applyMigration(file, sql);
    // eslint-disable-next-line no-console
    console.log(`Applied migration: ${file}`);
  }

  // eslint-disable-next-line no-console
  console.log('Migrations up to date.');
  await getPool().end();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

