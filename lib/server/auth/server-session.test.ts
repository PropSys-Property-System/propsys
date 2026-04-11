import { describe, expect, it, vi } from 'vitest';
import { getSessionUserFromCookieHeader } from './server-session';

const query = vi.fn();

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query,
  }),
}));

describe('server-session', () => {
  it('returns null when cookie header missing', async () => {
    query.mockReset();
    const user = await getSessionUserFromCookieHeader(null);
    expect(user).toBeNull();
    expect(query.mock.calls.length).toBe(0);
  });

  it('returns user when session is valid and user ACTIVE', async () => {
    query.mockReset();

    query.mockResolvedValueOnce({ rows: [{ user_id: 'u1', client_id: 'client_001' }] });
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'u1',
          email: 'manager@propsys.com',
          name: 'Gestora Principal',
          role: 'MANAGER',
          internal_role: 'CLIENT_MANAGER',
          client_id: 'client_001',
          scope: 'client',
          status: 'ACTIVE',
        },
      ],
    });

    const user = await getSessionUserFromCookieHeader('ps_session=sess_00000000-0000-0000-0000-000000000000');
    expect(user?.id).toBe('u1');
    expect(user?.status).toBe('ACTIVE');
  });

  it('revokes session and returns null when user is not ACTIVE', async () => {
    query.mockReset();

    query.mockResolvedValueOnce({ rows: [{ user_id: 'u12', client_id: 'client_001' }] });
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'u12',
          email: 'inactive@propsys.com',
          name: 'Usuario Inactivo',
          role: 'TENANT',
          internal_role: 'OCCUPANT',
          client_id: 'client_001',
          scope: 'client',
          status: 'SUSPENDED',
        },
      ],
    });
    query.mockResolvedValueOnce({ rows: [] });

    const user = await getSessionUserFromCookieHeader('ps_session=sess_00000000-0000-0000-0000-000000000000');
    expect(user).toBeNull();
    const revokeCalls = query.mock.calls.filter(([sql]) => typeof sql === 'string' && (sql as string).startsWith('UPDATE auth_sessions SET revoked_at'));
    expect(revokeCalls.length).toBe(1);
  });
});


