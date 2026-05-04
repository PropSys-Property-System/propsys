import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, PATCH, POST, PUT } from './common-areas/route';

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
  id: 'u_mgr',
  clientId: 'client_001' as string | null,
  email: 'manager@propsys.com',
  name: 'Manager',
  role: 'MANAGER',
  internalRole: 'CLIENT_MANAGER' as const,
  scope: 'client' as const,
  status: 'ACTIVE' as const,
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('physical common areas API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    connect.mockClear();
    release.mockReset();
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';
  });

  it('lists archived areas when status=ARCHIVED', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings')) return { rows: [{ id: 'b1', client_id: 'client_001' }] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      if (sql.includes('FROM common_areas')) {
        expect(sql).toContain("status = $2");
        return {
          rows: [
            {
              id: 'ca1',
              client_id: 'client_001',
              building_id: 'b1',
              name: 'Piscina',
              capacity: 20,
              requires_approval: true,
              status: 'ARCHIVED',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await GET(new Request('http://localhost/api/v1/physical/common-areas?buildingId=b1&status=ARCHIVED'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { areas: Array<{ id: string }> };
    expect(data.areas[0]?.id).toBe('ca1');
  });

  it('creates common area', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings')) return { rows: [{ id: 'b1', client_id: 'client_001', status: 'ACTIVE' }] };
      if (sql.includes('FROM common_areas')) return { rows: [] };
      return { rows: [] };
    });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO common_areas')) {
        return {
          rows: [
            {
              id: 'ca_new',
              client_id: 'client_001',
              building_id: 'b1',
              name: 'Terraza',
              capacity: 30,
              requires_approval: false,
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/common-areas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', name: 'Terraza', capacity: 30, requiresApproval: false }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { area: { name: string } };
    expect(data.area.name).toBe('Terraza');
  });

  it('updates and archives/restores common area', async () => {
    let currentStatus = 'ACTIVE';
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('id <> $2')) return { rows: [] };
      if (sql.includes('FROM common_areas')) {
        return {
          rows: [
            {
              id: 'ca1',
              client_id: 'client_001',
              building_id: 'b1',
              name: 'Quincho',
              capacity: 15,
              requires_approval: true,
              status: currentStatus,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM reservations')) return { rows: [{ total: '0' }] };
      return { rows: [] };
    });
    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE common_areas')) {
        if (params?.[1] === 'ARCHIVED') currentStatus = 'ARCHIVED';
        if (params?.[1] === 'ACTIVE') currentStatus = 'ACTIVE';
        return {
          rows: [
            {
              id: 'ca1',
              client_id: 'client_001',
              building_id: 'b1',
              name: 'Quincho Grande',
              capacity: Number(params?.[2] ?? 20),
              requires_approval: true,
              status: typeof params?.[1] === 'string' ? params?.[1] : 'ACTIVE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const updateReq = new Request('http://localhost/api/v1/physical/common-areas', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'ca1', name: 'Quincho Grande', capacity: 20, requiresApproval: true }),
    });
    const updateRes = await PUT(updateReq);
    expect(updateRes.status).toBe(200);

    const archiveReq = new Request('http://localhost/api/v1/physical/common-areas', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'ca1' }),
    });
    const archiveRes = await DELETE(archiveReq);
    expect(archiveRes.status).toBe(200);

    const restoreReq = new Request('http://localhost/api/v1/physical/common-areas', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'ca1', restore: true }),
    });
    const restoreRes = await DELETE(restoreReq);
    expect(restoreRes.status).toBe(200);
  });

  it('keeps PATCH for approval toggle', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM common_areas')) {
        return {
          rows: [
            {
              id: 'ca1',
              client_id: 'client_001',
              building_id: 'b1',
              name: 'Quincho',
              capacity: 15,
              requires_approval: true,
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        };
      }
      return { rows: [] };
    });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE common_areas')) {
        return {
          rows: [
            {
              id: 'ca1',
              client_id: 'client_001',
              building_id: 'b1',
              name: 'Quincho',
              capacity: 15,
              requires_approval: false,
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/common-areas', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'ca1', requiresApproval: false }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { area: { requiresApproval: boolean } };
    expect(data.area.requiresApproval).toBe(false);
  });
});
