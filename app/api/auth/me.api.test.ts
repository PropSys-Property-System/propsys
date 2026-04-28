import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as me } from './me/route';

const query = vi.fn();

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query,
  }),
}));

const sessionUser = {
  id: 'u_test',
  clientId: 'client_001',
  email: 'test@propsys.com',
  name: 'Test',
  role: 'MANAGER',
  internalRole: 'OCCUPANT',
  scope: 'client',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  canUseMockSession: () => process.env.NODE_ENV === 'development',
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('/api/auth/me', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows mock session hydration in development', async () => {
    query.mockReset();
    vi.stubEnv('NODE_ENV', 'development');

    const req = new Request('http://localhost/api/auth/me', {
      method: 'GET',
      headers: { cookie: 'ps_session=mock_u0' },
    });
    const res = await me(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { id: string; internalRole: string } };
    expect(data.user.id).toBe('u0');
    expect(data.user.internalRole).toBe('ROOT_ADMIN');
  });

  it('rejects mock session hydration outside development', async () => {
    query.mockReset();
    vi.stubEnv('NODE_ENV', 'production');

    const req = new Request('http://localhost/api/auth/me', {
      method: 'GET',
      headers: { cookie: 'ps_session=mock_u0' },
    });
    const res = await me(req);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { user: null };
    expect(data.user).toBeNull();
    expect(query.mock.calls.length).toBe(0);
  });

  it('derives role from internalRole (does not trust persisted role)', async () => {
    query.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'OCCUPANT';
    (sessionUser as unknown as { role: string }).role = 'MANAGER';
    (sessionUser as unknown as { scope: string }).scope = 'client';
    (sessionUser as unknown as { clientId: string | null }).clientId = 'client_001';

    query.mockResolvedValue({ rows: [] });

    const req = new Request('http://localhost/api/auth/me', { method: 'GET' });
    const res = await me(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { role: string; internalRole: string } };
    expect(data.user.internalRole).toBe('OCCUPANT');
    expect(data.user.role).toBe('TENANT');
  });

  it('filters assignments by client_id when scope is not platform (prevents cross-tenant leakage)', async () => {
    query.mockReset();
    (sessionUser as unknown as { id: string }).id = 'u_test';
    (sessionUser as unknown as { scope: string }).scope = 'client';
    (sessionUser as unknown as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as unknown as { internalRole: string }).internalRole = 'OWNER';
    (sessionUser as unknown as { role: string }).role = 'OWNER';

    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM user_building_assignments')) {
        const hasTenantFilter = sql.includes('client_id = $2');
        expect(hasTenantFilter).toBe(true);
        expect(params?.[0]).toBe('u_test');
        expect(params?.[1]).toBe('client_001');
        return {
          rows: [
            {
              id: 'uba_ok',
              client_id: 'client_001',
              user_id: 'u_test',
              building_id: 'b1',
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            },
          ],
        };
      }
      if (sql.includes('FROM user_unit_assignments')) {
        const hasTenantFilter = sql.includes('client_id = $2');
        expect(hasTenantFilter).toBe(true);
        expect(params?.[0]).toBe('u_test');
        expect(params?.[1]).toBe('client_001');
        return {
          rows: [
            {
              id: 'uua_ok',
              client_id: 'client_001',
              user_id: 'u_test',
              unit_id: 'unit-101',
              assignment_type: 'OWNER',
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

    const req = new Request('http://localhost/api/auth/me', { method: 'GET' });
    const res = await me(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { buildingAssignments: Array<{ client_id: string }>; unitAssignments: Array<{ client_id: string }> };
    expect(data.buildingAssignments.every((a) => a.client_id === 'client_001')).toBe(true);
    expect(data.unitAssignments.every((a) => a.client_id === 'client_001')).toBe(true);
  });

  it('keeps tenant filter for CLIENT_MANAGER even if scope is platform', async () => {
    query.mockReset();
    (sessionUser as unknown as { id: string }).id = 'u_manager';
    (sessionUser as unknown as { scope: string }).scope = 'platform';
    (sessionUser as unknown as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as unknown as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as unknown as { role: string }).role = 'MANAGER';

    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM user_building_assignments') || sql.includes('FROM user_unit_assignments')) {
        expect(sql).toContain('client_id = $2');
        expect(params?.[0]).toBe('u_manager');
        expect(params?.[1]).toBe('client_001');
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/auth/me', { method: 'GET' });
    const res = await me(req);
    expect(res.status).toBe(200);
  });
});

