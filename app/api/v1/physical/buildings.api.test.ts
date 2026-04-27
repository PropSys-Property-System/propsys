import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as createBuilding } from './buildings/route';
import { DELETE as archiveBuilding } from './buildings/[id]/route';
import { PATCH as restoreBuilding } from './buildings/[id]/route';

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
  email: 'root.qa@propsys.com',
  name: 'Root QA',
  role: 'MANAGER',
  internalRole: 'ROOT_ADMIN' as const,
  scope: 'platform' as const,
  status: 'ACTIVE' as const,
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

describe('physical buildings API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    sessionUser.id = 'u_root';
    sessionUser.clientId = null;
    sessionUser.internalRole = 'ROOT_ADMIN';
    sessionUser.scope = 'platform';
  });

  it('rejects ROOT_ADMIN building creation without explicit clientId', async () => {
    const req = new Request('http://localhost/api/v1/physical/buildings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Torre Nueva', address: 'Av. 1', city: 'Lima' }),
    });

    const res = await createBuilding(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Selecciona un cliente para crear el edificio.');
  });

  it('allows ROOT_ADMIN to create a building when clientId is explicit', async () => {
    let insertParams: unknown[] | null = null;
    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clients')) return { rows: [{ id: 'client_002' }] };
      if (sql.includes('FROM buildings WHERE client_id = $1')) return { rows: [] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO buildings')) {
        insertParams = params ?? null;
        return {
          rows: [
            {
              id: 'b_new',
              client_id: 'client_002',
              name: 'Condominio Mirador',
              address: 'Av. Sur 500',
              city: 'Arequipa',
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

    const req = new Request('http://localhost/api/v1/physical/buildings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: 'client_002', name: 'Condominio Mirador', address: 'Av. Sur 500', city: 'Arequipa' }),
    });

    const res = await createBuilding(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { building?: { clientId: string; name: string } };
    expect(data.building?.clientId).toBe('client_002');
    expect(data.building?.name).toBe('Condominio Mirador');
    expect(insertParams?.[1]).toBe('client_002');
    expect(auditParams?.[3]).toBe('CREATE');
    expect(auditParams?.[4]).toBe('Building');
  });

  it('keeps tenant-scoped creation for CLIENT_MANAGER', async () => {
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    let insertParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM clients')) {
        expect(params?.[0]).toBe('client_001');
        return { rows: [{ id: 'client_001' }] };
      }
      if (sql.includes('FROM buildings WHERE client_id = $1')) {
        expect(params?.[0]).toBe('client_001');
        return { rows: [] };
      }
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO buildings')) {
        insertParams = params ?? null;
        return {
          rows: [
            {
              id: 'b_new',
              client_id: 'client_001',
              name: 'Torre Parque',
              address: 'Av. Principal 777',
              city: 'Lima',
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/buildings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: 'client_002', name: 'Torre Parque', address: 'Av. Principal 777', city: 'Lima' }),
    });

    const res = await createBuilding(req);
    expect(res.status).toBe(200);
    expect(insertParams?.[1]).toBe('client_001');
  });

  it('rejects duplicate building names within the same client', async () => {
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    poolQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM clients')) {
        expect(params?.[0]).toBe('client_001');
        return { rows: [{ id: 'client_001' }] };
      }
      if (sql.includes('FROM buildings')) {
        expect(params?.[0]).toBe('client_001');
        return { rows: [{ id: 'b_existing' }] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/buildings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Edificio Central', address: 'Av. Principal 123', city: 'Lima' }),
    });

    const res = await createBuilding(req);
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Ya existe un edificio con ese nombre para este cliente.');
    expect(connect).not.toHaveBeenCalled();
  });

  it('archives an active building without active dependencies', async () => {
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings') && sql.includes('WHERE id = $1')) {
        return {
          rows: [
            {
              id: 'b_duplicate',
              client_id: 'client_001',
              name: 'Torre Duplicada',
              address: 'Av. Central',
              city: 'Lima',
              status: 'ACTIVE',
            },
          ],
        };
      }
      if (sql.includes('FROM units')) return { rows: [{ total: '0' }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE buildings')) {
        expect(params?.[0]).toBe('b_duplicate');
        return {
          rows: [
            {
              id: 'b_duplicate',
              client_id: 'client_001',
              name: 'Torre Duplicada',
              address: 'Av. Central',
              city: 'Lima',
              status: 'ARCHIVED',
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

    const res = await archiveBuilding(new Request('http://localhost/api/v1/physical/buildings/b_duplicate', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'b_duplicate' }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { building?: { id: string } };
    expect(data.building?.id).toBe('b_duplicate');
    expect(auditParams?.[3]).toBe('ARCHIVE');
    expect(auditParams?.[4]).toBe('Building');
  });

  it('blocks archiving a building with active dependencies', async () => {
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings') && sql.includes('WHERE id = $1')) {
        return {
          rows: [
            {
              id: 'b1',
              client_id: 'client_001',
              name: 'Edificio Central',
              address: 'Av. Principal 123',
              city: 'Lima',
              status: 'ACTIVE',
            },
          ],
        };
      }
      if (sql.includes('FROM units')) return { rows: [{ total: '1' }] };
      return { rows: [] };
    });

    const res = await archiveBuilding(new Request('http://localhost/api/v1/physical/buildings/b1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'b1' }),
    });

    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No puedes archivar un edificio con datos asociados activos.');
    expect(connect).not.toHaveBeenCalled();
  });

  it('restores an archived building when there is no active duplicate', async () => {
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings') && sql.includes('WHERE id = $1')) {
        return {
          rows: [
            {
              id: 'b_archived',
              client_id: 'client_001',
              name: 'Torre Archivada',
              address: 'Av. Central',
              city: 'Lima',
              status: 'ARCHIVED',
            },
          ],
        };
      }
      if (sql.includes('FROM buildings') && sql.includes("status = 'ACTIVE'")) return { rows: [] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE buildings')) {
        expect(params?.[0]).toBe('b_archived');
        return {
          rows: [
            {
              id: 'b_archived',
              client_id: 'client_001',
              name: 'Torre Archivada',
              address: 'Av. Central',
              city: 'Lima',
              status: 'ACTIVE',
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

    const res = await restoreBuilding(new Request('http://localhost/api/v1/physical/buildings/b_archived', { method: 'PATCH' }), {
      params: Promise.resolve({ id: 'b_archived' }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { building?: { id: string } };
    expect(data.building?.id).toBe('b_archived');
    expect(auditParams?.[3]).toBe('RESTORE');
    expect(auditParams?.[4]).toBe('Building');
  });

  it('blocks restoring an archived building when an active duplicate exists', async () => {
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings') && sql.includes('WHERE id = $1')) {
        return {
          rows: [
            {
              id: 'b_archived',
              client_id: 'client_001',
              name: 'Torre 2',
              address: 'Av. Central',
              city: 'Lima',
              status: 'ARCHIVED',
            },
          ],
        };
      }
      if (sql.includes('FROM buildings') && sql.includes("status = 'ACTIVE'")) return { rows: [{ id: 'b_active' }] };
      return { rows: [] };
    });

    const res = await restoreBuilding(new Request('http://localhost/api/v1/physical/buildings/b_archived', { method: 'PATCH' }), {
      params: Promise.resolve({ id: 'b_archived' }),
    });

    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Ya existe un edificio activo con ese nombre para este cliente.');
    expect(connect).not.toHaveBeenCalled();
  });

  it('returns 500 when audit log insert fails', async () => {
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM clients')) return { rows: [{ id: 'client_001' }] };
      if (sql.includes('FROM buildings WHERE client_id = $1')) return { rows: [] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN') return { rows: [] };
      if (sql.includes('INSERT INTO buildings')) {
        return {
          rows: [
            {
              id: 'b_new',
              client_id: 'client_001',
              name: 'Torre Sol',
              address: 'Av. Sol 123',
              city: 'Lima',
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO audit_logs')) throw new Error('audit down');
      if (sql === 'ROLLBACK') return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/buildings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Torre Sol', address: 'Av. Sol 123', city: 'Lima' }),
    });

    const res = await createBuilding(req);
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('No pudimos registrar la auditoría.');
  });
});
