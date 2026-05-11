import { describe, expect, it, vi } from 'vitest';
import { GET as listNotices, POST as createNotice } from './notices/route';

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
  id: 'u_root',
  clientId: null as string | null,
  email: 'root@propsys.com',
  name: 'Root',
  role: 'MANAGER',
  internalRole: 'ROOT_ADMIN',
  scope: 'platform',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('notices API (tenant/platform scope hardening)', () => {
  it('allows ROOT_ADMIN + scope=platform to bypass tenant filter (cross-tenant)', async () => {
    poolQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'ROOT_ADMIN';
    (sessionUser as unknown as { scope: string }).scope = 'platform';
    (sessionUser as unknown as { clientId: string | null }).clientId = null;

    const dataset = [
      {
        id: 'n1',
        client_id: 'client_001',
        audience: 'ALL_BUILDINGS',
        building_id: null,
        title: 'Aviso 1',
        body: 'b',
        status: 'PUBLISHED',
        created_by_user_id: 'u1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        deleted_at: null,
      },
      {
        id: 'n2',
        client_id: 'client_002',
        audience: 'ALL_BUILDINGS',
        building_id: null,
        title: 'Aviso 2',
        body: 'b',
        status: 'PUBLISHED',
        created_by_user_id: 'u2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        deleted_at: null,
      },
    ];

    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.trim() === 'SELECT id FROM buildings') return { rows: [{ id: 'b1' }, { id: 'b2' }] };
      if (sql.includes('FROM notices')) {
        expect(sql).not.toContain('AND client_id =');
        expect((params ?? []).length).toBe(0);
        return { rows: dataset };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/notices', { method: 'GET' });
    const res = await listNotices(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { notices: Array<{ id: string }> };
    const ids = new Set(data.notices.map((n) => n.id));
    expect(ids.has('n1')).toBe(true);
    expect(ids.has('n2')).toBe(true);
  });

  it('prevents CLIENT_MANAGER + scope=platform from bypassing tenant filter', async () => {
    poolQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as unknown as { scope: string }).scope = 'platform';
    (sessionUser as unknown as { clientId: string | null }).clientId = 'client_001';

    const dataset = [
      {
        id: 'n1',
        client_id: 'client_001',
        audience: 'ALL_BUILDINGS',
        building_id: null,
        title: 'Aviso 1',
        body: 'b',
        status: 'PUBLISHED',
        created_by_user_id: 'u1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        deleted_at: null,
      },
      {
        id: 'n2',
        client_id: 'client_002',
        audience: 'ALL_BUILDINGS',
        building_id: null,
        title: 'Aviso 2',
        body: 'b',
        status: 'PUBLISHED',
        created_by_user_id: 'u2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        deleted_at: null,
      },
    ];

    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('SELECT id FROM buildings WHERE client_id = $1')) {
        expect(params?.[0]).toBe('client_001');
        return { rows: [{ id: 'b1' }] };
      }
      if (sql.includes('FROM notices')) {
        expect(sql).toContain('AND client_id = $1');
        const clientId = params?.[0] as string;
        return { rows: dataset.filter((r) => r.client_id === clientId) };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/notices', { method: 'GET' });
    const res = await listNotices(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { notices: Array<{ id: string }> };
    const ids = new Set(data.notices.map((n) => n.id));
    expect(ids.has('n1')).toBe(true);
    expect(ids.has('n2')).toBe(false);
  });

  it('does not show ALL_BUILDINGS notices to a BUILDING_ADMIN without assignments', async () => {
    poolQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'BUILDING_ADMIN';
    (sessionUser as unknown as { scope: string }).scope = 'client';
    (sessionUser as unknown as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as unknown as { id: string }).id = 'u_admin_empty';

    const dataset = [
      {
        id: 'n1',
        client_id: 'client_001',
        audience: 'ALL_BUILDINGS',
        building_id: null,
        title: 'Aviso global',
        body: 'b',
        status: 'PUBLISHED',
        created_by_user_id: 'u1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        deleted_at: null,
      },
      {
        id: 'n2',
        client_id: 'client_001',
        audience: 'BUILDING',
        building_id: 'b1',
        title: 'Aviso edificio',
        body: 'b',
        status: 'PUBLISHED',
        created_by_user_id: 'u2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        deleted_at: null,
      },
    ];

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM user_building_assignments')) {
        return { rows: [] };
      }
      if (sql.includes('FROM notices')) {
        return { rows: dataset };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/notices', { method: 'GET' });
    const res = await listNotices(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { notices: Array<{ id: string }> };
    expect(data.notices).toEqual([]);
  });

  it('rejects ROOT_ADMIN + scope=platform notice creation without explicit clientId', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'ROOT_ADMIN';
    (sessionUser as unknown as { scope: string }).scope = 'platform';
    (sessionUser as unknown as { clientId: string | null }).clientId = null;

    const req = new Request('http://localhost/api/v1/notices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audience: 'ALL_BUILDINGS', title: 't', body: 'b' }),
    });
    const res = await createNotice(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Selecciona un cliente para publicar el aviso.');
  });

  it('allows ROOT_ADMIN + scope=platform notice creation when clientId is explicit', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'ROOT_ADMIN';
    (sessionUser as unknown as { scope: string }).scope = 'platform';
    (sessionUser as unknown as { clientId: string | null }).clientId = null;
    (sessionUser as unknown as { id: string }).id = 'u_root';

    let insertParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clients')) return { rows: [{ id: 'client_002' }] };
      return { rows: [] };
    });
    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO notices')) {
        insertParams = params ?? null;
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/notices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: 'client_002', audience: 'ALL_BUILDINGS', title: 't', body: 'b' }),
    });
    const res = await createNotice(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { notice?: { clientId: string } };
    expect(data.notice?.clientId).toBe('client_002');
    expect(Array.isArray(insertParams)).toBe(true);
    expect(insertParams?.[1]).toBe('client_002');
  });

  it('keeps tenant-scoped creation for CLIENT_MANAGER (ignores platform bypass)', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'CLIENT_MANAGER';
    (sessionUser as unknown as { scope: string }).scope = 'client';
    (sessionUser as unknown as { clientId: string | null }).clientId = 'client_001';
    (sessionUser as unknown as { id: string }).id = 'u_mgr';

    let insertParams: unknown[] | null = null;
    poolQuery.mockImplementation(async () => ({ rows: [] }));
    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO notices')) {
        insertParams = params ?? null;
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/notices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audience: 'ALL_BUILDINGS', title: 't', body: 'b' }),
    });
    const res = await createNotice(req);
    expect(res.status).toBe(200);
    expect(Array.isArray(insertParams)).toBe(true);
    expect(insertParams?.[1]).toBe('client_001');
  });

  it('does not ignore audit failure silently when creating a notice', async () => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    (sessionUser as unknown as { internalRole: string }).internalRole = 'ROOT_ADMIN';
    (sessionUser as unknown as { scope: string }).scope = 'platform';
    (sessionUser as unknown as { clientId: string | null }).clientId = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clients')) return { rows: [{ id: 'client_001' }] };
      return { rows: [] };
    });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('INSERT INTO notices')) return { rows: [] };
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('audit down');
      if (sql === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/notices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: 'client_001', audience: 'ALL_BUILDINGS', title: 't', body: 'b' }),
    });
    const res = await createNotice(req);
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No pudimos registrar la auditoría.');
  });
});
