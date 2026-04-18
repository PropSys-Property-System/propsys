import { describe, expect, it, vi } from 'vitest';
import { PATCH as patchIncident } from './incidents/[id]/route';

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
  id: 'u2',
  clientId: 'client_001',
  email: 'building.admin@propsys.com',
  name: 'Building Admin',
  role: 'MANAGER',
  internalRole: 'BUILDING_ADMIN',
  scope: 'client',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('operation incidents [id] API (audit hardening)', () => {
  it('fails when audit insert fails (no silent swallow)', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { role: string }).role = 'MANAGER';
    (sessionUser as unknown as { internalRole: string }).internalRole = 'BUILDING_ADMIN';
    (sessionUser as unknown as { id: string }).id = 'u2';
    (sessionUser as unknown as { clientId: string }).clientId = 'client_001';
    (sessionUser as unknown as { scope: string }).scope = 'client';

    const current = {
      id: 'inc_1',
      client_id: 'client_001',
      building_id: 'b1',
      unit_id: null,
      title: 't',
      description: 'd',
      status: 'IN_PROGRESS',
      priority: 'LOW',
      reported_by_user_id: 'u2',
      assigned_to_user_id: 'u3',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM incidents') && sql.includes('WHERE id = $1')) return { rows: [current] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('UPDATE incidents')) return { rows: [{ ...current, status: 'CLOSED', updated_at: new Date().toISOString() }] };
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('audit down');
      if (sql === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/incidents/inc_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' }),
    });
    const res = await patchIncident(req, { params: Promise.resolve({ id: 'inc_1' }) });
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No pudimos registrar la auditoría.');
  });
});
