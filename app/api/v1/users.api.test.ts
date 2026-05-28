import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as listUsers, POST as createUser } from './users/route';

const query = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));

vi.mock('argon2', () => ({
  default: {
    argon2id: 2,
    hash: vi.fn(async () => 'hashed_pw'),
  },
}));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query,
    connect,
  }),
}));

const sessionUser: {
  id: string;
  clientId: string | null;
  email: string;
  name: string;
  role: 'MANAGER';
  internalRole: 'ROOT_ADMIN' | 'CLIENT_MANAGER';
  scope: 'platform' | 'client';
  status: 'ACTIVE';
} = {
  id: 'u_root',
  clientId: null,
  email: 'root.qa@propsys.com',
  name: 'Root QA',
  role: 'MANAGER',
  internalRole: 'ROOT_ADMIN',
  scope: 'platform',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('users API', () => {
  beforeEach(() => {
    query.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    vi.mocked(argon2.hash).mockClear();
    sessionUser.id = 'u_root';
    sessionUser.clientId = null;
    sessionUser.internalRole = 'ROOT_ADMIN';
    sessionUser.scope = 'platform';
  });

  it('derives UI role from internal_role instead of trusting users.role', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'u_staff',
          email: 'staff@propsys.com',
          name: 'Staff Operativo',
          role: 'MANAGER',
          internal_role: 'STAFF',
          client_id: 'client_001',
          scope: 'client',
          status: 'ACTIVE',
          building_id: 'b1',
          unit_id: null,
        },
      ],
    });

    const res = await listUsers(new Request('http://localhost/api/v1/users'));
    expect(res.status).toBe(200);

    const data = (await res.json()) as { users: Array<{ role: string; internalRole: string }> };
    expect(data.users).toHaveLength(1);
    expect(data.users[0].internalRole).toBe('STAFF');
    expect(data.users[0].role).toBe('STAFF');
  });

  it('keeps tenant scoping for CLIENT_MANAGER in client scope', async () => {
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.clientId = 'client_001';
    sessionUser.scope = 'client';

    query.mockResolvedValueOnce({ rows: [] });

    const res = await listUsers(new Request('http://localhost/api/v1/users'));
    expect(res.status).toBe(200);

    const sql = query.mock.calls[0]?.[0] as string;
    const params = query.mock.calls[0]?.[1] as unknown[];
    expect(sql).toContain('WHERE u.client_id = $1');
    expect(params).toEqual(['client_001']);

    sessionUser.internalRole = 'ROOT_ADMIN';
    sessionUser.clientId = null;
    sessionUser.scope = 'platform';
  });

  it('blocks direct user creation in favor of invitations without returning a temp password', async () => {
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    query.mockResolvedValueOnce({
      rows: [{ id: 'b1', client_id: 'client_001' }],
    });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO users')) {
        return {
          rows: [
            {
              id: 'u_new',
              email: 'nuevo.staff@propsys.com',
              name: 'Staff Nuevo',
              internal_role: 'STAFF',
              client_id: 'client_001',
              scope: 'client',
              status: 'ACTIVE',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Staff Nuevo',
        email: 'nuevo.staff@propsys.com',
        internalRole: 'STAFF',
        buildingId: 'b1',
      }),
    });
    const res = await createUser(req);
    expect(res.status).toBe(410);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const data = (await res.json()) as { error: string; tempPassword?: string };
    expect(data.error).toBe('La creacion directa de usuarios fue reemplazada por invitaciónes. Usa /api/v1/users/invitations.');
    expect(data.tempPassword).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
