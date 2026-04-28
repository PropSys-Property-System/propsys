import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSessionUserFromCookieHeader } from './server-session';

const query = vi.fn();

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query,
  }),
}));

describe('server-session', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it('allows mock sessions in development', async () => {
    query.mockReset();
    vi.stubEnv('NODE_ENV', 'development');

    const user = await getSessionUserFromCookieHeader('ps_session=mock_u0');
    expect(user?.id).toBe('u0');
    expect(user?.internalRole).toBe('ROOT_ADMIN');
    expect(query.mock.calls.length).toBe(0);
  });

  it('rejects mock sessions outside development', async () => {
    query.mockReset();
    vi.stubEnv('NODE_ENV', 'production');

    const user = await getSessionUserFromCookieHeader('ps_session=mock_u0');
    expect(user).toBeNull();
    expect(query.mock.calls.length).toBe(0);
  });

  it('derives role from internal_role (does not trust persisted role)', async () => {
    query.mockReset();

    query.mockResolvedValueOnce({ rows: [{ user_id: 'u3', client_id: 'client_001' }] });
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'u3',
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

    const user = await getSessionUserFromCookieHeader('ps_session=sess_00000000-0000-0000-0000-000000000000');
    expect(user?.internalRole).toBe('STAFF');
    expect(user?.role).toBe('STAFF');
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


