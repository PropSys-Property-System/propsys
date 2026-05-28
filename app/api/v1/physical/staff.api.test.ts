import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as listStaff, POST as createStaff } from './staff/route';

const poolQuery = vi.fn();
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
    query: poolQuery,
    connect,
  }),
}));

type TestInternalRole = 'ROOT_ADMIN' | 'CLIENT_MANAGER' | 'BUILDING_ADMIN' | 'STAFF' | 'OWNER' | 'OCCUPANT';

function sessionFor(internalRole: TestInternalRole) {
  return {
    id: internalRole === 'BUILDING_ADMIN' ? 'u_building_admin' : 'u_mgr',
    clientId: internalRole === 'ROOT_ADMIN' ? null : 'client_001',
    email: 'manager@propsys.com',
    name: 'Gestora Principal',
    role: internalRole === 'OWNER' ? 'OWNER' : internalRole === 'OCCUPANT' ? 'TENANT' : 'MANAGER',
    internalRole,
    scope: internalRole === 'ROOT_ADMIN' ? 'platform' : 'client',
    status: 'ACTIVE',
  };
}

const authState = vi.hoisted(() => ({
  user: {
    id: 'u_mgr',
    clientId: 'client_001',
    email: 'manager@propsys.com',
    name: 'Gestora Principal',
    role: 'MANAGER',
    internalRole: 'CLIENT_MANAGER',
    scope: 'client',
    status: 'ACTIVE',
  } as ReturnType<typeof sessionFor> | null,
}));

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => authState.user),
}));

function validCreateRequest() {
  return new Request('http://localhost/api/v1/physical/staff', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ buildingId: 'b1', name: 'Staff Nuevo', email: 'staff.new@propsys.com', password: 'StrongStaff#2026' }),
  });
}

function mockLegacyCreationDbSuccess() {
  poolQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM buildings')) return { rows: [{ client_id: 'client_001' }] };
    if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
    return { rows: [] };
  });

  clientQuery.mockImplementation(async (sql: string) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
    if (sql.includes('INSERT INTO users')) return { rows: [] };
    if (sql.includes('INSERT INTO user_building_assignments')) return { rows: [] };
    return { rows: [] };
  });
}

describe('physical staff API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    vi.mocked(argon2.hash).mockClear();
    authState.user = sessionFor('CLIENT_MANAGER');
  });

  it('keeps listing staff for an authorized client manager', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM buildings')) return { rows: [{ id: 'b1' }] };
      if (sql.includes('SELECT DISTINCT u.id')) {
        return {
          rows: [
            {
              id: 'u_staff',
              name: 'Staff Operativo',
              internal_role: 'STAFF',
              building_id: 'b1',
              status: 'INACTIVE',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const res = await listStaff(new Request('http://localhost/api/v1/physical/staff?buildingId=b1'));

    expect(res.status).toBe(200);
    const data = (await res.json()) as { staff: Array<{ id: string; name: string; role: string; status: string }> };
    expect(data.staff).toEqual([{ id: 'u_staff', buildingId: 'b1', name: 'Staff Operativo', role: 'Personal', status: 'INACTIVE' }]);
  });

  it('returns 401 for direct staff creation without a session', async () => {
    authState.user = null;

    const res = await createStaff(validCreateRequest());

    expect(res.status).toBe(401);
    expect(poolQuery).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it.each(['OWNER', 'OCCUPANT', 'STAFF'] as const)('returns 403 for %s direct staff creation', async (role) => {
    authState.user = sessionFor(role);

    const res = await createStaff(validCreateRequest());

    expect(res.status).toBe(403);
    expect(poolQuery).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it.each(['ROOT_ADMIN', 'CLIENT_MANAGER', 'BUILDING_ADMIN'] as const)(
    'returns 410 for %s direct staff creation without creating users or passwords',
    async (role) => {
      authState.user = sessionFor(role);
      mockLegacyCreationDbSuccess();

      const res = await createStaff(validCreateRequest());

      expect(res.status).toBe(410);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      const data = (await res.json()) as { error: string; tempPassword?: string };
      expect(data.error).toBe('La creación directa de staff fue reemplazada por invitaciónes. Usa /api/v1/users/invitations.');
      expect(data.tempPassword).toBeUndefined();
      expect(poolQuery).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
      expect(argon2.hash).not.toHaveBeenCalled();
    }
  );
});
