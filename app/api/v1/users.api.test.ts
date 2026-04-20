import { describe, expect, it, vi } from 'vitest';
import { GET as listUsers } from './users/route';

const query = vi.fn();

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query,
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
  it('derives UI role from internal_role instead of trusting users.role', async () => {
    query.mockReset();
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
    query.mockReset();
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.clientId = 'client_001';
    sessionUser.scope = 'client';

    query.mockResolvedValueOnce({ rows: [] });

    const res = await listUsers(new Request('http://localhost/api/v1/users'));
    expect(res.status).toBe(200);

    const sql = query.mock.calls[0]?.[0] as string;
    const params = query.mock.calls[0]?.[1] as unknown[];
    expect(sql).toContain('WHERE client_id = $1');
    expect(params).toEqual(['client_001']);

    sessionUser.internalRole = 'ROOT_ADMIN';
    sessionUser.clientId = null;
    sessionUser.scope = 'platform';
  });
});
