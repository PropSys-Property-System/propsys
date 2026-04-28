import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as createStaff } from './staff/route';
import { validateStaffPassword } from '@/lib/server/auth/staff-password';

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

const sessionUser = {
  id: 'u_mgr',
  clientId: 'client_001' as string | null,
  email: 'manager@propsys.com',
  name: 'Gestora Principal',
  role: 'MANAGER',
  internalRole: 'CLIENT_MANAGER' as const,
  scope: 'client' as const,
  status: 'ACTIVE' as const,
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('physical staff API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    vi.mocked(argon2.hash).mockClear();
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';
  });

  it('creates staff with a generated password that satisfies policy', async () => {
    let userInsertParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings')) return { rows: [{ client_id: 'client_001' }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO users')) {
        userInsertParams = params ?? null;
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO user_building_assignments')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/staff', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', name: 'Staff Nuevo', email: 'staff.new@propsys.com' }),
    });

    const res = await createStaff(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const data = (await res.json()) as { staff?: { id: string }; tempPassword?: string };
    expect(data.staff?.id).toMatch(/^u_/);
    expect(data.tempPassword).toBeDefined();
    expect(validateStaffPassword(data.tempPassword ?? '')).toBe(true);
    expect(argon2.hash).toHaveBeenCalledWith(data.tempPassword, { type: argon2.argon2id });
    expect(userInsertParams?.[3]).toBe('hashed_pw');
  });

  it('rejects weak manual staff passwords before opening a transaction', async () => {
    const req = new Request('http://localhost/api/v1/physical/staff', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        buildingId: 'b1',
        name: 'Staff Nuevo',
        email: 'staff.new@propsys.com',
        password: 'weak',
      }),
    });

    const res = await createStaff(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('La contrasena debe tener al menos 12 caracteres e incluir mayuscula, minuscula, numero y simbolo.');
    expect(connect).not.toHaveBeenCalled();
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('keeps accepting strong manual staff passwords', async () => {
    const manualPassword = 'StrongStaff#2026';

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings')) return { rows: [{ client_id: 'client_001' }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO users')) return { rows: [] };
      if (sql.includes('INSERT INTO user_building_assignments')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/staff', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        buildingId: 'b1',
        name: 'Staff Nuevo',
        email: 'staff.new@propsys.com',
        password: manualPassword,
      }),
    });

    const res = await createStaff(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { tempPassword?: string };
    expect(data.tempPassword).toBe(manualPassword);
    expect(argon2.hash).toHaveBeenCalledWith(manualPassword, { type: argon2.argon2id });
  });
});
