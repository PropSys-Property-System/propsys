import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as createUnit } from './units/route';

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
  name: 'Gestora Principal',
  role: 'MANAGER',
  internalRole: 'CLIENT_MANAGER' as const,
  scope: 'client' as const,
  status: 'ACTIVE' as const,
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('physical units API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';
  });

  it('creates a unit inside an accessible active building', async () => {
    let insertParams: unknown[] | null = null;
    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings')) return { rows: [{ id: 'b1', client_id: 'client_001' }] };
      if (sql.includes('FROM units')) return { rows: [] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO units')) {
        insertParams = params ?? null;
        return {
          rows: [
            {
              id: 'unit_new',
              client_id: 'client_001',
              building_id: 'b1',
              number: '103',
              floor: '1',
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        auditParams = params ?? null;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/units', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', number: '103', floor: '1' }),
    });

    const res = await createUnit(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { unit?: { clientId: string; buildingId: string; number: string } };
    expect(data.unit?.clientId).toBe('client_001');
    expect(data.unit?.buildingId).toBe('b1');
    expect(data.unit?.number).toBe('103');
    expect(insertParams?.[1]).toBe('client_001');
    expect(auditParams?.[3]).toBe('CREATE');
    expect(auditParams?.[4]).toBe('Unit');
  });

  it('rejects duplicate unit numbers within the same building', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings')) return { rows: [{ id: 'b1', client_id: 'client_001' }] };
      if (sql.includes('FROM units')) return { rows: [{ id: 'unit-101' }] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/units', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', number: '101', floor: '1' }),
    });

    const res = await createUnit(req);
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Ya existe una unidad con ese numero en este edificio.');
    expect(connect).not.toHaveBeenCalled();
  });

  it('does not allow a client manager to create units in another tenant building', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings')) return { rows: [{ id: 'b3', client_id: 'client_002' }] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/units', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b3', number: '302', floor: '3' }),
    });

    const res = await createUnit(req);
    expect(res.status).toBe(404);
    expect(connect).not.toHaveBeenCalled();
  });
});
