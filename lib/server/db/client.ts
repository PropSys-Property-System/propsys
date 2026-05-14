import { Pool } from 'pg';

const DEFAULT_POOL_MAX = 3;
const DEFAULT_IDLE_TIMEOUT_MS = 10_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;

type GlobalWithPool = typeof globalThis & {
  __propsysPgPool?: Pool;
  __propsysPgPoolKey?: string;
};

type PoolSettings = {
  connectionString: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
};

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getPoolSettings(): PoolSettings {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL no configurada');
  }

  return {
    connectionString,
    max: parsePositiveInteger(process.env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX),
    idleTimeoutMillis: DEFAULT_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: DEFAULT_CONNECTION_TIMEOUT_MS,
  };
}

export function getPool(): Pool {
  const globalForPool = globalThis as GlobalWithPool;
  const settings = getPoolSettings();
  const poolKey = JSON.stringify(settings);

  if (globalForPool.__propsysPgPool && globalForPool.__propsysPgPoolKey === poolKey) {
    return globalForPool.__propsysPgPool;
  }

  if (globalForPool.__propsysPgPool) {
    void globalForPool.__propsysPgPool.end().catch(() => null);
  }

  globalForPool.__propsysPgPool = new Pool(settings);
  globalForPool.__propsysPgPoolKey = poolKey;
  return globalForPool.__propsysPgPool;
}
