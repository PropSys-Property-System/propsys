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

describe('reservations [id] API (audit hardening)', () => {
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
      body: JSON.stringify({ action: 'CANCEL' }),
    });
    const res = await patchReservation(req, { params: Promise.resolve({ id: 'res_1' }) });
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No pudimos registrar la auditoría.');
  });
});

