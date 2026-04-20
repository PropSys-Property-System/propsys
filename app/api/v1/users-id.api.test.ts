import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH as patchUser } from './users/[id]/route';

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
  email: 'root.qa@propsys.com',
  name: 'Root QA',
  role: 'MANAGER',
  internalRole: 'ROOT_ADMIN' as const,
  scope: 'platform' as const,
  status: 'ACTIVE' as const,
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('users [id] API', () => {
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

  it('allows ROOT_ADMIN to suspend a cross-tenant user and revoke active sessions', async () => {
    const current = {
      id: 'u_staff_sur',
      email: 'staff.sur@propsys.com',
      name: 'Staff Sur',
      internal_role: 'STAFF',
      client_id: 'client_002',
      scope: 'client',
      status: 'ACTIVE',
    };

    let auditParams: unknown[] | null = null;
    let revokeParams: unknown[] | null = null;

    poolQuery.mockResolvedValueOnce({ rows: [current] });
    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE users')) return { rows: [{ ...current, status: 'SUSPENDED' }] };
      if (sql.includes('UPDATE auth_sessions')) {
        revokeParams = params ?? null;
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        auditParams = params ?? null;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/users/u_staff_sur', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const res = await patchUser(req, { params: Promise.resolve({ id: 'u_staff_sur' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { status: string } };
    expect(data.user.status).toBe('SUSPENDED');
    expect(revokeParams?.[0]).toBe('u_staff_sur');
    expect(auditParams?.[3]).toBe('DEACTIVATE');
  });

  it('allows CLIENT_MANAGER to reactivate a same-tenant non-manager user', async () => {
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    const current = {
      id: 'u_staff',
      email: 'staff@propsys.com',
      name: 'Staff',
      internal_role: 'STAFF',
      client_id: 'client_001',
      scope: 'client',
      status: 'SUSPENDED',
    };

    let auditParams: unknown[] | null = null;

    poolQuery.mockResolvedValueOnce({ rows: [current] });
    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE users')) return { rows: [{ ...current, status: 'ACTIVE' }] };
      if (sql.includes('UPDATE auth_sessions')) throw new Error('should not revoke on restore');
      if (sql.includes('INSERT INTO audit_logs')) {
        auditParams = params ?? null;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/users/u_staff', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const res = await patchUser(req, { params: Promise.resolve({ id: 'u_staff' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user: { status: string } };
    expect(data.user.status).toBe('ACTIVE');
    expect(auditParams?.[3]).toBe('RESTORE');
  });

  it('prevents CLIENT_MANAGER from changing another manager or platform user', async () => {
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'u_mgr_2',
          email: 'manager2@propsys.com',
          name: 'Manager 2',
          internal_role: 'CLIENT_MANAGER',
          client_id: 'client_001',
          scope: 'client',
          status: 'ACTIVE',
        },
      ],
    });

    const req = new Request('http://localhost/api/v1/users/u_mgr_2', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const res = await patchUser(req, { params: Promise.resolve({ id: 'u_mgr_2' }) });
    expect(res.status).toBe(403);
    expect(clientQuery).not.toHaveBeenCalled();
  });

  it('prevents changing your own status', async () => {
    poolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'u_root',
          email: 'root.qa@propsys.com',
          name: 'Root QA',
          internal_role: 'ROOT_ADMIN',
          client_id: null,
          scope: 'platform',
          status: 'ACTIVE',
        },
      ],
    });

    const req = new Request('http://localhost/api/v1/users/u_root', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    const res = await patchUser(req, { params: Promise.resolve({ id: 'u_root' }) });
    expect(res.status).toBe(400);
    expect(clientQuery).not.toHaveBeenCalled();
  });
});
