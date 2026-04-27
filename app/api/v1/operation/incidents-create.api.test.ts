import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as createIncident } from './incidents/route';

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
  id: 'u_staff',
  clientId: 'client_001' as string | null,
  email: 'staff@propsys.com',
  name: 'Staff Operativo',
  role: 'STAFF',
  internalRole: 'STAFF' as string,
  scope: 'client' as string,
  status: 'ACTIVE' as string,
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

function incidentCreatedRow(buildingId = 'b1', clientId = 'client_001') {
  const now = new Date().toISOString();
  return {
    id: 'inc_new',
    client_id: clientId,
    building_id: buildingId,
    unit_id: null,
    title: 'Fuga de agua',
    description: 'Hay agua en el pasillo',
    status: 'REPORTED',
    priority: 'HIGH',
    reported_by_user_id: 'u_staff',
    assigned_to_user_id: 'u_staff',
    created_at: now,
    updated_at: now,
  };
}

describe('operation incidents POST (audit regression)', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    sessionUser.id = 'u_staff';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'STAFF';
    sessionUser.scope = 'client';
  });

  it('creates an incident as STAFF and records audit log', async () => {
    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT client_id FROM buildings')) return { rows: [{ client_id: 'client_001' }] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO incidents')) return { rows: [incidentCreatedRow()] };
      if (sql.includes('INSERT INTO audit_logs')) {
        auditParams = params ?? null;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', title: 'Fuga de agua', description: 'Hay agua en el pasillo', priority: 'HIGH' }),
    });

    const res = await createIncident(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { incident?: { status: string } };
    expect(data.incident?.status).toBe('REPORTED');
    expect(auditParams?.[3]).toBe('CREATE');
    expect(auditParams?.[4]).toBe('Incident');
  });

  it('returns 403 when OCCUPANT attempts to create an incident', async () => {
    sessionUser.internalRole = 'OCCUPANT';

    const req = new Request('http://localhost/api/v1/operation/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', title: 'Fuga', description: 'Fuga de agua', priority: 'HIGH' }),
    });

    const res = await createIncident(req);
    expect(res.status).toBe(403);
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns 400 for missing required fields (no priority)', async () => {
    const req = new Request('http://localhost/api/v1/operation/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', title: 'Fuga de agua', description: 'Hay agua' }),
    });

    const res = await createIncident(req);
    expect(res.status).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns 500 when audit log insert fails during incident creation (no silent swallow)', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT client_id FROM buildings')) return { rows: [{ client_id: 'client_001' }] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('INSERT INTO incidents')) return { rows: [incidentCreatedRow()] };
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('audit down');
      if (sql === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', title: 'Fuga de agua', description: 'Hay agua en el pasillo', priority: 'HIGH' }),
    });

    const res = await createIncident(req);
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No pudimos registrar la auditoría.');
  });
});
