import { describe, expect, it, vi } from 'vitest';
import { GET as listIncidents } from './incidents/route';

const query = vi.fn();

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query,
  }),
}));

const sessionUser = {
  id: 'u5',
  clientId: 'client_001',
  email: 'tenant@propsys.com',
  name: 'Inquilino',
  role: 'TENANT',
  internalRole: 'OCCUPANT',
  scope: 'client',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

function incidentRow(input: {
  id: string;
  clientId: string;
  buildingId: string;
  unitId: string | null;
  reportedByUserId: string;
  assignedToUserId: string | null;
}) {
  const now = new Date().toISOString();
  return {
    id: input.id,
    client_id: input.clientId,
    building_id: input.buildingId,
    unit_id: input.unitId,
    title: 't',
    description: 'd',
    status: 'REPORTED',
    priority: 'LOW',
    reported_by_user_id: input.reportedByUserId,
    assigned_to_user_id: input.assignedToUserId,
    created_at: now,
    updated_at: now,
  };
}

describe('operation incidents API (route handlers)', () => {
  it('scopes OWNER/OCCUPANT building-level incidents to buildings of assigned units', async () => {
    query.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'OCCUPANT';
    (sessionUser as unknown as { role: string }).role = 'TENANT';
    (sessionUser as unknown as { id: string }).id = 'u5';

    const dataset = [
      incidentRow({
        id: 'inc_unit_b1',
        clientId: 'client_001',
        buildingId: 'b1',
        unitId: 'unit-102',
        reportedByUserId: 'u3',
        assignedToUserId: 'u3',
      }),
      incidentRow({
        id: 'inc_building_b1',
        clientId: 'client_001',
        buildingId: 'b1',
        unitId: null,
        reportedByUserId: 'u2',
        assignedToUserId: 'u3',
      }),
      incidentRow({
        id: 'inc_building_b2',
        clientId: 'client_001',
        buildingId: 'b2',
        unitId: null,
        reportedByUserId: 'u2',
        assignedToUserId: 'u3',
      }),
    ];

    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT unit_id') && sql.includes('FROM user_unit_assignments')) return { rows: [{ unit_id: 'unit-102' }] };
      if (sql.includes('SELECT DISTINCT u.building_id') && sql.includes('FROM user_unit_assignments')) return { rows: [{ building_id: 'b1' }] };
      if (sql.includes('FROM incidents')) {
        const sqlText = sql;
        expect(sqlText).toContain('unit_id = ANY');
        expect(sqlText).toContain('unit_id IS NULL AND building_id = ANY');

        const arrays = (params ?? []).filter((p): p is string[] => Array.isArray(p));
        const unitIds = arrays[0] ?? [];
        const buildingIds = arrays[1] ?? [];
        const clientId = typeof (params?.[0] ?? '') === 'string' ? (params?.[0] as string) : 'client_001';

        const rows = dataset
          .filter((r) => r.client_id === clientId)
          .filter((r) => (r.unit_id ? unitIds.includes(r.unit_id) : buildingIds.includes(r.building_id)));
        return { rows };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/incidents', { method: 'GET' });
    const res = await listIncidents(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { incidents: Array<{ id: string }> };
    const ids = new Set(data.incidents.map((i) => i.id));
    expect(ids.has('inc_building_b1')).toBe(true);
    expect(ids.has('inc_building_b2')).toBe(false);
  });

  it('does not change STAFF listing semantics (building-scoped + assigned/reported)', async () => {
    query.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'STAFF';
    (sessionUser as unknown as { role: string }).role = 'STAFF';
    (sessionUser as unknown as { id: string }).id = 'u3';

    const dataset = [
      incidentRow({
        id: 'inc_staff_b1_assigned',
        clientId: 'client_001',
        buildingId: 'b1',
        unitId: null,
        reportedByUserId: 'u2',
        assignedToUserId: 'u3',
      }),
      incidentRow({
        id: 'inc_staff_b1_not_involved',
        clientId: 'client_001',
        buildingId: 'b1',
        unitId: null,
        reportedByUserId: 'u2',
        assignedToUserId: 'u9',
      }),
      incidentRow({
        id: 'inc_staff_b2_assigned',
        clientId: 'client_001',
        buildingId: 'b2',
        unitId: null,
        reportedByUserId: 'u2',
        assignedToUserId: 'u3',
      }),
    ];

    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ building_id: 'b1' }] };
      if (sql.includes('FROM incidents')) {
        const sqlText = sql;
        expect(sqlText).toContain('building_id = ANY');
        expect(sqlText).toContain('assigned_to_user_id');
        expect(sqlText).toContain('reported_by_user_id');

        const arrays = (params ?? []).filter((p): p is string[] => Array.isArray(p));
        const buildingIds = arrays[0] ?? [];
        const staffUserId = typeof params?.[2] === 'string' ? (params?.[2] as string) : 'u3';
        const clientId = typeof params?.[0] === 'string' ? (params?.[0] as string) : 'client_001';

        const rows = dataset
          .filter((r) => r.client_id === clientId)
          .filter((r) => buildingIds.includes(r.building_id))
          .filter((r) => r.assigned_to_user_id === staffUserId || r.reported_by_user_id === staffUserId);
        return { rows };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/incidents', { method: 'GET' });
    const res = await listIncidents(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { incidents: Array<{ id: string }> };
    const ids = new Set(data.incidents.map((i) => i.id));
    expect(ids.has('inc_staff_b1_assigned')).toBe(true);
    expect(ids.has('inc_staff_b1_not_involved')).toBe(false);
    expect(ids.has('inc_staff_b2_assigned')).toBe(false);
  });

  it('allows ROOT_ADMIN + scope=platform to bypass tenant filter (cross-tenant visibility)', async () => {
    query.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'ROOT_ADMIN';
    (sessionUser as unknown as { role: string }).role = 'MANAGER';
    (sessionUser as unknown as { scope: string }).scope = 'platform';
    (sessionUser as unknown as { clientId: string | null }).clientId = null;
    (sessionUser as unknown as { id: string }).id = 'u_root';

    const dataset = [
      incidentRow({
        id: 'inc_c1',
        clientId: 'client_001',
        buildingId: 'b1',
        unitId: null,
        reportedByUserId: 'u2',
        assignedToUserId: null,
      }),
      incidentRow({
        id: 'inc_c2',
        clientId: 'client_002',
        buildingId: 'b2',
        unitId: null,
        reportedByUserId: 'u20',
        assignedToUserId: null,
      }),
    ];

    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.trim() === 'SELECT id FROM buildings') return { rows: [{ id: 'b1' }, { id: 'b2' }] };
      if (sql.includes('FROM incidents')) {
        expect(sql).not.toContain('AND client_id =');
        const arrays = (params ?? []).filter((p): p is string[] => Array.isArray(p));
        const buildingIds = arrays[0] ?? [];
        return { rows: dataset.filter((r) => buildingIds.includes(r.building_id)) };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/incidents', { method: 'GET' });
    const res = await listIncidents(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { incidents: Array<{ id: string }> };
    const ids = new Set(data.incidents.map((i) => i.id));
    expect(ids.has('inc_c1')).toBe(true);
    expect(ids.has('inc_c2')).toBe(true);
  });

  it('prevents CLIENT_MANAGER + scope=platform from bypassing tenant filter', async () => {
    query.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as unknown as { role: string }).role = 'MANAGER';
    (sessionUser as unknown as { scope: string }).scope = 'platform';
    (sessionUser as unknown as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as unknown as { id: string }).id = 'u_mgr';

    const dataset = [
      incidentRow({
        id: 'inc_c1',
        clientId: 'client_001',
        buildingId: 'b1',
        unitId: null,
        reportedByUserId: 'u2',
        assignedToUserId: null,
      }),
      incidentRow({
        id: 'inc_c2',
        clientId: 'client_002',
        buildingId: 'b2',
        unitId: null,
        reportedByUserId: 'u20',
        assignedToUserId: null,
      }),
    ];

    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT id FROM buildings WHERE client_id = $1')) {
        expect(params?.[0]).toBe('client_001');
        return { rows: [{ id: 'b1' }] };
      }
      if (sql.includes('FROM incidents')) {
        expect(sql).toContain('AND client_id = $1');
        const clientId = params?.[0] as string;
        const arrays = (params ?? []).filter((p): p is string[] => Array.isArray(p));
        const buildingIds = arrays[0] ?? [];
        return { rows: dataset.filter((r) => r.client_id === clientId).filter((r) => buildingIds.includes(r.building_id)) };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/operation/incidents', { method: 'GET' });
    const res = await listIncidents(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { incidents: Array<{ id: string }> };
    const ids = new Set(data.incidents.map((i) => i.id));
    expect(ids.has('inc_c1')).toBe(true);
    expect(ids.has('inc_c2')).toBe(false);
  });
});

