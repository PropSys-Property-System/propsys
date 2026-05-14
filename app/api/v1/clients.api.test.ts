import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './clients/route';

const poolQuery = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query: poolQuery,
    connect,
  }),
}));

const sessionUser = {
  id: 'u_root',
  clientId: null as string | null,
  email: 'root@propsys.com',
  name: 'Root',
  role: 'MANAGER',
  internalRole: 'ROOT_ADMIN' as string,
  scope: 'platform' as string,
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('clients API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    sessionUser.id = 'u_root';
    sessionUser.clientId = null;
    sessionUser.internalRole = 'ROOT_ADMIN';
    sessionUser.scope = 'platform';
  });

  it('lets ROOT_ADMIN list active clients', async () => {
    poolQuery.mockResolvedValue({
      rows: [{ id: 'client_001', slug: 'acme', name: 'Acme Administraciones', status: 'ACTIVE', created_at: '2026-05-01T00:00:00.000Z' }],
    });

    const res = await GET(new Request('http://localhost/api/v1/clients'));

    expect(res.status).toBe(200);
    const data = (await res.json()) as { clients: Array<{ id: string; name: string }> };
    expect(data.clients).toEqual([{ id: 'client_001', slug: 'acme', name: 'Acme Administraciones', status: 'ACTIVE', createdAt: '2026-05-01T00:00:00.000Z' }]);
  });

  it('lets ROOT_ADMIN create a client without a building', async () => {
    poolQuery.mockResolvedValue({ rows: [] });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO clients')) {
        return {
          rows: [{ id: 'client_new', slug: 'empresa-nueva', name: 'Empresa Nueva', status: 'ACTIVE', created_at: '2026-05-01T00:00:00.000Z' }],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const res = await POST(
      new Request('http://localhost/api/v1/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: ' Empresa Nueva ' }),
      })
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { client: { id: string; name: string } };
    expect(data.client).toMatchObject({ id: 'client_new', name: 'Empresa Nueva' });
    expect(clientQuery.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO clients'))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO audit_logs'))).toBe(true);
  });

  it('rejects client creation for CLIENT_MANAGER', async () => {
    sessionUser.id = 'u_manager';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    const res = await POST(
      new Request('http://localhost/api/v1/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Empresa Nueva' }),
      })
    );

    expect(res.status).toBe(403);
    expect(connect).not.toHaveBeenCalled();
  });
});
