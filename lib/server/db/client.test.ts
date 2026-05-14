import { afterEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  instances: [] as Array<{ options: unknown; ended: boolean; end: () => Promise<void> }>,
}));

const PoolMock = vi.hoisted(() =>
  vi.fn(function Pool(options: unknown) {
    const instance = {
      options,
      ended: false,
      async end() {
        instance.ended = true;
      },
    };
    mockState.instances.push(instance);
    return instance;
  })
);

vi.mock('pg', () => ({
  Pool: PoolMock,
}));

type GlobalWithPool = typeof globalThis & {
  __propsysPgPool?: unknown;
  __propsysPgPoolKey?: string;
};

function clearGlobalPool() {
  const globalForPool = globalThis as GlobalWithPool;
  delete globalForPool.__propsysPgPool;
  delete globalForPool.__propsysPgPoolKey;
}

async function loadClientModule() {
  return import('./client');
}

describe('database pool client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_POOL_MAX;
    clearGlobalPool();
    PoolMock.mockClear();
    mockState.instances = [];
    vi.resetModules();
  });

  it('uses a small pool by default for Supabase session pooler safety', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://postgres:postgres@example.com:5432/postgres');
    const { getPoolSettings } = await loadClientModule();

    expect(getPoolSettings()).toEqual({
      connectionString: 'postgres://postgres:postgres@example.com:5432/postgres',
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  });

  it('allows DATABASE_POOL_MAX to override the default when it is valid', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://postgres:postgres@example.com:5432/postgres');
    vi.stubEnv('DATABASE_POOL_MAX', '5');
    const { getPoolSettings } = await loadClientModule();

    expect(getPoolSettings().max).toBe(5);
  });

  it('falls back to the default pool max for invalid values', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://postgres:postgres@example.com:5432/postgres');
    vi.stubEnv('DATABASE_POOL_MAX', '0');
    const { getPoolSettings } = await loadClientModule();

    expect(getPoolSettings().max).toBe(3);
  });

  it('reuses the same pool across module reloads when settings do not change', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://postgres:postgres@example.com:5432/postgres');

    const firstModule = await loadClientModule();
    const firstPool = firstModule.getPool();

    vi.resetModules();

    const secondModule = await loadClientModule();
    const secondPool = secondModule.getPool();

    expect(secondPool).toBe(firstPool);
    expect(PoolMock).toHaveBeenCalledTimes(1);
    expect(PoolMock).toHaveBeenCalledWith({
      connectionString: 'postgres://postgres:postgres@example.com:5432/postgres',
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  });

  it('closes a stale global pool when settings change', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://postgres:postgres@example.com:5432/postgres');
    vi.stubEnv('DATABASE_POOL_MAX', '3');

    const firstModule = await loadClientModule();
    firstModule.getPool();

    vi.stubEnv('DATABASE_POOL_MAX', '5');
    vi.resetModules();

    const secondModule = await loadClientModule();
    secondModule.getPool();

    expect(mockState.instances).toHaveLength(2);
    expect(mockState.instances[0].ended).toBe(true);
    expect(mockState.instances[1].ended).toBe(false);
  });
});
