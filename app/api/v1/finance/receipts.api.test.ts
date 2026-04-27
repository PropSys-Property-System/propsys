import { describe, expect, it, vi } from 'vitest';
import { GET as listReceipts, POST as createReceipt } from './receipts/route';
import { GET as getReceipt, PATCH as patchReceipt } from './receipts/[id]/route';

const query = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query, release }));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query,
    connect,
  }),
}));

const sessionUser = {
  id: 'u4',
  clientId: 'client_001' as string | null,
  email: 'owner@propsys.com',
  name: 'Owner',
  role: 'OWNER',
  internalRole: 'OWNER',
  scope: 'client',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

function receiptRow(input: {
  id: string;
  clientId: string;
  buildingId: string;
  unitId: string;
}) {
  return {
    id: input.id,
    client_id: input.clientId,
    building_id: input.buildingId,
    unit_id: input.unitId,
    number: `RC-${input.id}`,
    description: 'Recibo de prueba',
    amount: '150.00',
    currency: 'PEN',
    issue_date: '2026-04-01',
    due_date: '2026-04-10',
    status: 'PENDING',
  };
}

describe('finance receipts API (route handlers)', () => {
  it('allows ROOT_ADMIN + scope=platform to bypass tenant filter in list', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'ROOT_ADMIN';
    (sessionUser as { role: string }).role = 'MANAGER';
    (sessionUser as { scope: string }).scope = 'platform';
    (sessionUser as { clientId: string | null }).clientId = null;
    (sessionUser as { id: string }).id = 'u_root';

    const dataset = [
      receiptRow({ id: 'r1', clientId: 'client_001', buildingId: 'b1', unitId: 'unit-101' }),
      receiptRow({ id: 'r2', clientId: 'client_002', buildingId: 'b3', unitId: 'unit-301' }),
    ];

    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.trim() === 'SELECT id FROM buildings') return { rows: [{ id: 'b1' }, { id: 'b3' }] };
      if (sql.includes('FROM receipts')) {
        expect(sql).not.toContain('AND client_id =');
        const arrays = (params ?? []).filter((p): p is string[] => Array.isArray(p));
        const buildingIds = arrays[0] ?? [];
        return { rows: dataset.filter((row) => buildingIds.includes(row.building_id)) };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/receipts', { method: 'GET' });
    const res = await listReceipts(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { receipts: Array<{ id: string }> };
    const ids = new Set(data.receipts.map((row) => row.id));
    expect(ids.has('r1')).toBe(true);
    expect(ids.has('r2')).toBe(true);
  });

  it('prevents CLIENT_MANAGER + scope=platform from bypassing tenant filter in list', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as { role: string }).role = 'MANAGER';
    (sessionUser as { scope: string }).scope = 'platform';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as { id: string }).id = 'u_mgr';

    const dataset = [
      receiptRow({ id: 'r1', clientId: 'client_001', buildingId: 'b1', unitId: 'unit-101' }),
      receiptRow({ id: 'r2', clientId: 'client_002', buildingId: 'b3', unitId: 'unit-301' }),
    ];

    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT id FROM buildings WHERE client_id = $1')) {
        expect(params?.[0]).toBe('client_001');
        return { rows: [{ id: 'b1' }] };
      }
      if (sql.includes('FROM receipts')) {
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

    const req = new Request('http://localhost/api/v1/finance/receipts', { method: 'GET' });
    const res = await listReceipts(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { receipts: Array<{ id: string }> };
    const ids = new Set(data.receipts.map((row) => row.id));
    expect(ids.has('r1')).toBe(true);
    expect(ids.has('r2')).toBe(false);
  });

  it('returns 404 for owner detail access without the matching unit assignment', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'OWNER';
    (sessionUser as { role: string }).role = 'OWNER';
    (sessionUser as { scope: string }).scope = 'client';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as { id: string }).id = 'u4';

    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM receipts')) {
        return { rows: [receiptRow({ id: 'r1', clientId: 'client_001', buildingId: 'b1', unitId: 'unit-101' })] };
      }
      if (sql.includes('FROM user_unit_assignments')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/receipts/r1', { method: 'GET' });
    const res = await getReceipt(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(404);
  });

  it('allows building admin detail access when assigned to the building', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'BUILDING_ADMIN';
    (sessionUser as { role: string }).role = 'MANAGER';
    (sessionUser as { scope: string }).scope = 'client';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as { id: string }).id = 'u2';

    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM receipts')) {
        return { rows: [receiptRow({ id: 'r1', clientId: 'client_001', buildingId: 'b1', unitId: 'unit-101' })] };
      }
      if (sql.includes('FROM user_building_assignments')) {
        return { rows: [{ ok: true }] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/receipts/r1', { method: 'GET' });
    const res = await getReceipt(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { receipt: { id: string; buildingId: string } };
    expect(data.receipt.id).toBe('r1');
    expect(data.receipt.buildingId).toBe('b1');
  });

  it('rejects POST with unauthorized role', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'OWNER';

    const req = new Request('http://localhost/api/v1/finance/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', unitId: 'u1', amount: 100, description: 'Test', issueDate: '2026-04-01', dueDate: '2026-04-10' }),
    });
    const res = await createReceipt(req);
    expect(res.status).toBe(403);
  });

  it('rejects POST with invalid payload', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';

    const req = new Request('http://localhost/api/v1/finance/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', unitId: 'u1', amount: null }),
    });
    const res = await createReceipt(req);
    expect(res.status).toBe(400);
  });

  it('rejects POST with invalid unit or tenant mismatch', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';

    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units')) {
        return { rows: [{ client_id: 'client_002', building_id: 'b1' }] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', unitId: 'u1', amount: 100, description: 'Test', issueDate: '2026-04-01', dueDate: '2026-04-10' }),
    });
    const res = await createReceipt(req);
    expect(res.status).toBe(403);
  });

  it('creates a receipt successfully', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as { id: string }).id = 'u_mgr';

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM units')) {
        return { rows: [{ client_id: 'client_001', building_id: 'b1' }] };
      }
      if (sql.includes('INSERT INTO receipts')) {
        return { rows: [{ id: 'new-rect', status: 'PENDING' }] };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', unitId: 'u1', amount: 150, description: 'Test', issueDate: '2026-04-01', dueDate: '2026-04-10' }),
    });
    const res = await createReceipt(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { receipt: { id: string; status: string } };
    expect(data.receipt.id).toBe('new-rect');
    expect(data.receipt.status).toBe('PENDING');

    const auditCall = query.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO audit_logs'));
    expect(auditCall).toBeDefined();
  });

  it('returns 500 when POST audit fails', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM units')) return { rows: [{ client_id: 'client_001', building_id: 'b1' }] };
      if (sql.includes('INSERT INTO receipts')) return { rows: [{ id: 'new-rect', status: 'PENDING' }] };
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('DB DOWN');
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ buildingId: 'b1', unitId: 'u1', amount: 150, description: 'Test', issueDate: '2026-04-01', dueDate: '2026-04-10' }),
    });
    const res = await createReceipt(req);
    expect(res.status).toBe(500);
  });

  it('rejects PATCH with invalid transition', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'CLIENT_MANAGER';

    const req = new Request('http://localhost/api/v1/finance/receipts/r1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'OVERDUE' }),
    });
    const res = await patchReceipt(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(400);
  });

  it('successfully transitions to PAID', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM receipts') && sql.includes('SELECT')) {
        return { rows: [{ id: 'r1', client_id: 'client_001', building_id: 'b1', status: 'PENDING' }] };
      }
      if (sql.includes('UPDATE receipts')) {
        return { rows: [{ id: 'r1', status: 'PAID' }] };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/receipts/r1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' }),
    });
    const res = await patchReceipt(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { receipt: { status: string } };
    expect(data.receipt.status).toBe('PAID');

    const auditCall = query.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO audit_logs'));
    expect(auditCall).toBeDefined();
  });

  it('successfully transitions to CANCELLED', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM receipts') && sql.includes('SELECT')) {
        return { rows: [{ id: 'r1', client_id: 'client_001', building_id: 'b1', status: 'PENDING' }] };
      }
      if (sql.includes('UPDATE receipts')) {
        return { rows: [{ id: 'r1', status: 'CANCELLED' }] };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/receipts/r1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    const res = await patchReceipt(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { receipt: { status: string } };
    expect(data.receipt.status).toBe('CANCELLED');
  });

  it('returns 500 when PATCH audit fails', async () => {
    query.mockReset();
    (sessionUser as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as { clientId: string | null }).clientId = 'client_001';

    query.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM receipts') && sql.includes('SELECT')) {
        return { rows: [{ id: 'r1', client_id: 'client_001', building_id: 'b1', status: 'PENDING' }] };
      }
      if (sql.includes('UPDATE receipts')) {
        return { rows: [{ id: 'r1', status: 'PAID' }] };
      }
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('DB DOWN');
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/receipts/r1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' }),
    });
    const res = await patchReceipt(req, { params: Promise.resolve({ id: 'r1' }) });
    expect(res.status).toBe(500);
  });
});
