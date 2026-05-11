import { Pool } from 'pg';

let poolSingleton: Pool | null = null;

export function getPool(): Pool {
  if (poolSingleton) return poolSingleton;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no configurada');
  }
  poolSingleton = new Pool({ connectionString });
  return poolSingleton;
}

