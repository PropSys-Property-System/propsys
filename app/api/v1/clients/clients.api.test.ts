import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getClients } from './route';
import { PATCH as updateClient } from './[id]/route';

const poolQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: poolQuery, release }));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query: poolQuery,
    connect,
  }),
}));

const sessionUser = {
  id: 'u_root',
  clientId: null,
  email: 'root@propsys.com',
  name: 'Root Admin',
  role: 'ROOT_ADMIN',
  internalRole: 'ROOT_ADMIN',
  scope: 'platform',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

vi.mock('@/lib/server/db/tx', () => ({
  withTransaction: async (_pool: unknown, fn: (db: { query: typeof poolQuery }) => Promise<unknown>) => {
    return fn({ query: poolQuery });
  },
}));

vi.mock('@/lib/server/audit/audit-log', () => ({
  insertAuditLog: vi.fn(),
}));

function makeGetRequest(search = '') {
  return new Request(`http://localhost/api/v1/clients${search}`, {
    method: 'GET',
  });
}

function makePatchRequest(id: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/v1/clients/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('clients API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    sessionUser.internalRole = 'ROOT_ADMIN';
  });

  describe('GET /api/v1/clients', () => {
    it('ROOT_ADMIN puede listar clientes incluyendo suspendidos si lo solicita', async () => {
      poolQuery.mockResolvedValueOnce({
        rows: [
          { id: 'c1', slug: 'c1', name: 'Client 1', status: 'ACTIVE', created_at: '2026-05-01' },
          { id: 'c2', slug: 'c2', name: 'Client 2', status: 'SUSPENDED', created_at: '2026-05-02' },
        ],
      });

      const res = await getClients(makeGetRequest('?includeSuspended=true'));
      expect(res.status).toBe(200);
      const data = await res.json() as { clients: Array<{ status: string }> };
      expect(data.clients).toHaveLength(2);
      expect(data.clients[1].status).toBe('SUSPENDED');
    });

    it('usuario no ROOT_ADMIN/CLIENT_MANAGER no puede listar clientes', async () => {
      sessionUser.internalRole = 'BUILDING_ADMIN';
      const res = await getClients(makeGetRequest());
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/clients/[id]', () => {
    it('ROOT_ADMIN puede suspender cliente', async () => {
      // Mock existing client
      poolQuery.mockResolvedValueOnce({
        rows: [{ id: 'c1', slug: 'c1', name: 'Client 1', status: 'ACTIVE', created_at: '2026-05-01' }],
      });
      // Mock update
      poolQuery.mockResolvedValueOnce({
        rows: [{ id: 'c1', slug: 'c1', name: 'Client 1', status: 'SUSPENDED', created_at: '2026-05-01' }],
      });

      const res = await updateClient(makePatchRequest('c1', { status: 'SUSPENDED' }), { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(200);
      const data = await res.json() as { client: { status: string } };
      expect(data.client.status).toBe('SUSPENDED');
    });

    it('ROOT_ADMIN puede editar nombre', async () => {
      // Mock existing client
      poolQuery.mockResolvedValueOnce({
        rows: [{ id: 'c1', slug: 'c1', name: 'Client 1', status: 'ACTIVE', created_at: '2026-05-01' }],
      });
      // Mock uniqueness check
      poolQuery.mockResolvedValueOnce({ rows: [] });
      // Mock update
      poolQuery.mockResolvedValueOnce({
        rows: [{ id: 'c1', slug: 'c1', name: 'Client 1 Editado', status: 'ACTIVE', created_at: '2026-05-01' }],
      });

      const res = await updateClient(makePatchRequest('c1', { name: 'Client 1 Editado' }), { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(200);
      const data = await res.json() as { client: { name: string } };
      expect(data.client.name).toBe('Client 1 Editado');
    });

    it('usuario no ROOT_ADMIN no puede modificar clientes', async () => {
      sessionUser.internalRole = 'CLIENT_MANAGER';
      const res = await updateClient(makePatchRequest('c1', { status: 'SUSPENDED' }), { params: Promise.resolve({ id: 'c1' }) });
      expect(res.status).toBe(403);
    });
  });
});
