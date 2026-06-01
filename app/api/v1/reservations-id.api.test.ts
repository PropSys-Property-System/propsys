import { describe, expect, it, vi } from 'vitest';
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
  clientId: 'client_001',
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

function reservationRow(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: 'res_1',
    client_id: 'client_001',
    building_id: 'b1',
    unit_id: 'unit-102',
    common_area_id: 'area-1',
    created_by_user_id: 'u5',
    start_at: new Date(Date.now() + 3600_000).toISOString(),
    end_at: new Date(Date.now() + 7200_000).toISOString(),
    status: 'REQUESTED',
    status_reason: null,
    status_reason_updated_at: null,
    status_reason_updated_by: null,
    cancelled_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('reservations [id] API (audit hardening)', () => {
  it('fails REJECT without reason', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'BUILDING_ADMIN';

    const req = new Request('http://localhost/api/v1/reservations/res_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'REJECT' }),
    });
    const res = await patchReservation(req, { params: Promise.resolve({ id: 'res_1' }) });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Debes ingresar un motivo.');
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('fails CANCEL without reason', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'OCCUPANT';

    const req = new Request('http://localhost/api/v1/reservations/res_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'CANCEL' }),
    });
    const res = await patchReservation(req, { params: Promise.resolve({ id: 'res_1' }) });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Debes ingresar un motivo.');
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('fails when reason is shorter than 8 characters', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'BUILDING_ADMIN';

    const req = new Request('http://localhost/api/v1/reservations/res_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'REJECT', reason: 'corto' }),
    });
    const res = await patchReservation(req, { params: Promise.resolve({ id: 'res_1' }) });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('El motivo debe tener al menos 8 caracteres.');
  });

  it('fails when reason is longer than 300 characters', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'BUILDING_ADMIN';

    const req = new Request('http://localhost/api/v1/reservations/res_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'REJECT', reason: 'a'.repeat(301) }),
    });
    const res = await patchReservation(req, { params: Promise.resolve({ id: 'res_1' }) });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('El motivo no puede superar 300 caracteres.');
  });

  it('fails when audit insert fails during CANCEL (no silent swallow)', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'OCCUPANT';
    (sessionUser as unknown as { id: string }).id = 'u5';
    (sessionUser as unknown as { clientId: string }).clientId = 'client_001';
    (sessionUser as unknown as { scope: string }).scope = 'client';

    const current = {
      id: 'res_1',
      client_id: 'client_001',
      building_id: 'b1',
      unit_id: 'unit-102',
      common_area_id: 'area-1',
      created_by_user_id: 'u5',
      start_at: new Date().toISOString(),
      end_at: new Date(Date.now() + 3600_000).toISOString(),
      status: 'APPROVED',
      cancelled_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM reservations') && sql.includes('WHERE id = $1')) return { rows: [current] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('UPDATE reservations')) return { rows: [{ ...current, status: 'CANCELLED', cancelled_at: new Date().toISOString() }] };
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('audit down');
      if (sql === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/reservations/res_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'CANCEL', reason: 'El residente solicitó cancelar la reserva.' }),
    });
    const res = await patchReservation(req, { params: Promise.resolve({ id: 'res_1' }) });
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No pudimos registrar la auditoría.');
  });

  it('approves a REQUESTED reservation and records audit log (action=APPROVE)', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'BUILDING_ADMIN';
    (sessionUser as unknown as { id: string }).id = 'u_badmin';
    (sessionUser as unknown as { clientId: string }).clientId = 'client_001';
    (sessionUser as unknown as { scope: string }).scope = 'client';

    const current = reservationRow({ id: 'res_2' });

    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM reservations') && sql.includes('WHERE id = $1')) return { rows: [current] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE reservations')) {
        return { rows: [{ ...current, status: 'APPROVED' }] };
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        auditParams = params ?? null;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/reservations/res_2', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    const res = await patchReservation(req, { params: Promise.resolve({ id: 'res_2' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { reservation: { status: string } };
    expect(data.reservation.status).toBe('APPROVED');
    expect(auditParams?.[3]).toBe('UPDATE');
    expect(auditParams?.[4]).toBe('Reservation');
    expect(JSON.parse(String(auditParams?.[6]))).toEqual({ action: 'APPROVE' });
  });

  it('rejects a REQUESTED reservation, persists statusReason and records audit reason', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'BUILDING_ADMIN';
    (sessionUser as unknown as { id: string }).id = 'u_badmin';
    (sessionUser as unknown as { clientId: string }).clientId = 'client_001';
    (sessionUser as unknown as { scope: string }).scope = 'client';

    const current = reservationRow({ id: 'res_3' });
    const reason = 'El área común no está disponible por mantenimiento.';

    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM reservations') && sql.includes('WHERE id = $1')) return { rows: [current] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE reservations')) {
        expect(params?.[2]).toBe(reason);
        expect(params?.[4]).toBe('u_badmin');
        return {
          rows: [
            {
              ...current,
              status: 'REJECTED',
              status_reason: reason,
              status_reason_updated_at: new Date().toISOString(),
              status_reason_updated_by: 'u_badmin',
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

    const req = new Request('http://localhost/api/v1/reservations/res_3', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'REJECT', reason }),
    });
    const res = await patchReservation(req, { params: Promise.resolve({ id: 'res_3' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { reservation: { status: string; statusReason?: string | null } };
    expect(data.reservation.status).toBe('REJECTED');
    expect(data.reservation.statusReason).toBe(reason);
    expect(auditParams?.[3]).toBe('UPDATE');
    expect(auditParams?.[4]).toBe('Reservation');
    expect(JSON.parse(String(auditParams?.[6]))).toEqual({ action: 'REJECT', reason });
  });

  it('cancels an APPROVED reservation as OWNER, persists statusReason and cancelledAt', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'OWNER';
    (sessionUser as unknown as { id: string }).id = 'u_owner';
    (sessionUser as unknown as { clientId: string }).clientId = 'client_001';
    (sessionUser as unknown as { scope: string }).scope = 'client';

    const current = reservationRow({
      id: 'res_4',
      created_by_user_id: 'u_owner',
      status: 'APPROVED',
    });
    const reason = 'El residente solicitó cancelar la reserva.';

    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM reservations') && sql.includes('WHERE id = $1')) return { rows: [current] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE reservations')) {
        expect(params?.[2]).toBe(reason);
        expect(params?.[3]).toBe('u_owner');
        return {
          rows: [
            {
              ...current,
              status: 'CANCELLED',
              status_reason: reason,
              status_reason_updated_at: new Date().toISOString(),
              status_reason_updated_by: 'u_owner',
              cancelled_at: new Date().toISOString(),
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

    const req = new Request('http://localhost/api/v1/reservations/res_4', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'CANCEL', reason }),
    });
    const res = await patchReservation(req, { params: Promise.resolve({ id: 'res_4' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { reservation: { status: string; statusReason?: string | null; cancelledAt?: string } };
    expect(data.reservation.status).toBe('CANCELLED');
    expect(data.reservation.statusReason).toBe(reason);
    expect(data.reservation.cancelledAt).toBeTruthy();
    expect(auditParams?.[3]).toBe('UPDATE');
    expect(auditParams?.[4]).toBe('Reservation');
    expect(JSON.parse(String(auditParams?.[6]))).toEqual({ action: 'CANCEL', reason });
  });
});

