import { describe, expect, it, vi } from 'vitest';
import { GET as listReservations, POST as createReservation } from './reservations/route';
import { PATCH as patchReservation } from './reservations/[id]/route';

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
  id: 'u5',
  clientId: 'client_001' as string | null,
  email: 'tenant@propsys.com',
  name: 'Tenant',
  role: 'TENANT',
  internalRole: 'OCCUPANT',
  scope: 'client',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

function reservationRow(input: {
  id: string;
  clientId: string;
  buildingId: string;
  unitId: string;
  commonAreaId: string;
  createdByUserId: string;
  status: string;
}) {
  const now = new Date().toISOString();
  return {
    id: input.id,
    client_id: input.clientId,
    building_id: input.buildingId,
    unit_id: input.unitId,
    common_area_id: input.commonAreaId,
    created_by_user_id: input.createdByUserId,
    start_at: now,
    end_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: input.status,
    cancelled_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };
}

describe('reservations API (route handlers)', () => {
  it('allows ROOT_ADMIN + scope=platform to bypass tenant filter in list', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'ROOT_ADMIN';
    (sessionUser as { role: string }).role = 'MANAGER';
    (sessionUser as { scope: string }).scope = 'platform';
    (sessionUser as { clientId: string | null }).clientId = null;
    (sessionUser as { id: string }).id = 'u_root';

    const dataset = [
      reservationRow({
        id: 'resv_c1',
        clientId: 'client_001',
        buildingId: 'b1',
        unitId: 'unit-101',
        commonAreaId: 'ca-1',
        createdByUserId: 'u4',
        status: 'APPROVED',
      }),
      reservationRow({
        id: 'resv_c2',
        clientId: 'client_002',
        buildingId: 'b3',
        unitId: 'unit-301',
        commonAreaId: 'ca-3',
        createdByUserId: 'u10',
        status: 'REQUESTED',
      }),
    ];

    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.trim() === 'SELECT id FROM buildings') return { rows: [{ id: 'b1' }, { id: 'b3' }] };
      if (sql.includes('FROM reservations')) {
        expect(sql).not.toContain('AND client_id =');
        const arrays = (params ?? []).filter((p): p is string[] => Array.isArray(p));
        const buildingIds = arrays[0] ?? [];
        return { rows: dataset.filter((row) => buildingIds.includes(row.building_id)) };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/reservations', { method: 'GET' });
    const res = await listReservations(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { reservations: Array<{ id: string }> };
    const ids = new Set(data.reservations.map((row) => row.id));
    expect(ids.has('resv_c1')).toBe(true);
    expect(ids.has('resv_c2')).toBe(true);
  });

  it('prevents CLIENT_MANAGER + scope=platform from bypassing tenant filter in list', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as { role: string }).role = 'MANAGER';
    (sessionUser as { scope: string }).scope = 'platform';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as { id: string }).id = 'u_mgr';

    const dataset = [
      reservationRow({
        id: 'resv_c1',
        clientId: 'client_001',
        buildingId: 'b1',
        unitId: 'unit-101',
        commonAreaId: 'ca-1',
        createdByUserId: 'u4',
        status: 'APPROVED',
      }),
      reservationRow({
        id: 'resv_c2',
        clientId: 'client_002',
        buildingId: 'b3',
        unitId: 'unit-301',
        commonAreaId: 'ca-3',
        createdByUserId: 'u10',
        status: 'REQUESTED',
      }),
    ];

    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT id FROM buildings WHERE client_id = $1')) {
        expect(params?.[0]).toBe('client_001');
        return { rows: [{ id: 'b1' }] };
      }
      if (sql.includes('FROM reservations')) {
        expect(sql).toContain('AND client_id = $1');
        const clientId = params?.[0] as string;
        const arrays = (params ?? []).filter((p): p is string[] => Array.isArray(p));
        const buildingIds = arrays[0] ?? [];
        return {
          rows: dataset.filter((row) => row.client_id === clientId).filter((row) => buildingIds.includes(row.building_id)),
        };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/reservations', { method: 'GET' });
    const res = await listReservations(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { reservations: Array<{ id: string }> };
    const ids = new Set(data.reservations.map((row) => row.id));
    expect(ids.has('resv_c1')).toBe(true);
    expect(ids.has('resv_c2')).toBe(false);
  });

  it('rejects creating a reservation for a unit without the matching occupant assignment', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'OCCUPANT';
    (sessionUser as { role: string }).role = 'TENANT';
    (sessionUser as { scope: string }).scope = 'client';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as { id: string }).id = 'u5';

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT client_id, building_id FROM units')) {
        return { rows: [{ client_id: 'client_001', building_id: 'b2' }] };
      }
      if (sql.includes('FROM user_unit_assignments')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/reservations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        buildingId: 'b2',
        unitId: 'unit-201',
        commonAreaId: 'ca-2',
        startAt: '2026-04-20T10:00:00.000Z',
        endAt: '2026-04-20T11:00:00.000Z',
      }),
    });
    const res = await createReservation(req);
    expect(res.status).toBe(403);
  });

  it('cancels an occupant reservation using a tenant-scoped unit assignment check', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'OCCUPANT';
    (sessionUser as { role: string }).role = 'TENANT';
    (sessionUser as { scope: string }).scope = 'client';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as { id: string }).id = 'u5';

    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM reservations')) {
        return {
          rows: [
            reservationRow({
              id: 'resv_1',
              clientId: 'client_001',
              buildingId: 'b1',
              unitId: 'unit-102',
              commonAreaId: 'ca-1',
              createdByUserId: 'u5',
              status: 'REQUESTED',
            }),
          ],
        };
      }
      if (sql.includes('FROM user_unit_assignments')) {
        expect(params?.[3]).toBe('client_001');
        return { rows: [{ ok: true }] };
      }
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.startsWith('UPDATE reservations')) {
        return {
          rows: [
            {
              ...reservationRow({
                id: 'resv_1',
                clientId: 'client_001',
                buildingId: 'b1',
                unitId: 'unit-102',
                commonAreaId: 'ca-1',
                createdByUserId: 'u5',
                status: 'CANCELLED',
              }),
              cancelled_at: new Date().toISOString(),
            },
          ],
        };
      }
      if (sql.startsWith('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/reservations/resv_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'CANCEL' }),
    });
    const res = await patchReservation(req, { params: Promise.resolve({ id: 'resv_1' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { reservation: { status: string } };
    expect(data.reservation.status).toBe('CANCELLED');
    const auditCalls = clientQuery.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && (sql as string).startsWith('INSERT INTO audit_logs')
    );
    expect(auditCalls.length).toBe(1);
  });

  it('returns 500 when audit insert fails during reservation creation (no silent swallow)', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'OCCUPANT';
    (sessionUser as { role: string }).role = 'TENANT';
    (sessionUser as { scope: string }).scope = 'client';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as { id: string }).id = 'u5';

    const now = new Date();
    const startAt = new Date(now.getTime() + 60_000).toISOString();
    const endAt = new Date(now.getTime() + 3_660_000).toISOString();

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT client_id, building_id FROM units')) {
        return { rows: [{ client_id: 'client_001', building_id: 'b1' }] };
      }
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ ok: true }] };
      if (sql.includes('FROM common_areas')) {
        return {
          rows: [{ requires_approval: false, client_id: 'client_001', building_id: 'b1', status: 'ACTIVE', deleted_at: null }],
        };
      }
      if (sql.includes('FROM reservations')) return { rows: [] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('INSERT INTO reservations')) {
        return {
          rows: [
            reservationRow({
              id: 'resv_fail',
              clientId: 'client_001',
              buildingId: 'b1',
              unitId: 'unit-102',
              commonAreaId: 'ca-1',
              createdByUserId: 'u5',
              status: 'APPROVED',
            }),
          ],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('audit down');
      if (sql === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/reservations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        buildingId: 'b1',
        unitId: 'unit-102',
        commonAreaId: 'ca-1',
        startAt,
        endAt,
      }),
    });

    const res = await createReservation(req);
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No pudimos registrar la auditoría.');
  });
});
