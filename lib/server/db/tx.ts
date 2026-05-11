import type { Pool, PoolClient } from 'pg';

export type Queryable = Pick<PoolClient, 'query'>;

export async function withTransaction<T>(pool: Pool, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => null);
    throw e;
  } finally {
    client.release();
  }
}

