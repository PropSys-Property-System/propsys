import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as unassignUnitResident } from './unit-assignments/route';
import { POST as assignUnitUser } from './unit-assignments/route';

const poolQuery = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));

vi.mock('argon2', () => ({
  default: {
    argon2id: 2,
    hash: vi.fn(async () => 'hashed_pw'),
  },
}));

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

function unitRow(clientId = 'client_001') {
  return {
    id: 'unit-103',
    client_id: clientId,
    building_id: 'b1',
    number: '103',
  };
}

describe('physical unit assignments API', () => {
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

  it('creates and assigns a new owner to an accessible unit', async () => {
    let userInsertParams: unknown[] | null = null;
    let assignmentInsertParams: unknown[] | null = null;
    const auditActions: unknown[] = [];

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [] };
      if (sql.includes('FROM users')) return { rows: [] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO users')) {
        userInsertParams = params ?? null;
        return {
          rows: [
            {
              id: 'u_owner_new',
              email: 'owner.new@propsys.com',
              name: 'Owner Nuevo',
              internal_role: 'OWNER',
              client_id: 'client_001',
              scope: 'client',
              status: 'ACTIVE',
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO user_unit_assignments')) {
        assignmentInsertParams = params ?? null;
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        auditActions.push(params?.[3]);
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/unit-assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        unitId: 'unit-103',
        assignmentType: 'OWNER',
        name: 'Owner Nuevo',
        email: 'owner.new@propsys.com',
        password: 'Temp123!',
      }),
    });

    const res = await assignUnitUser(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user?: { id: string; internalRole: string; unitId: string }; tempPassword?: string };
    expect(data.user?.id).toBe('u_owner_new');
    expect(data.user?.internalRole).toBe('OWNER');
    expect(data.user?.unitId).toBe('unit-103');
    expect(data.tempPassword).toBe('Temp123!');
    expect(userInsertParams?.[1]).toBe('client_001');
    expect(userInsertParams?.[6]).toBe('OWNER');
    expect(assignmentInsertParams?.[2]).toBe('u_owner_new');
    expect(assignmentInsertParams?.[4]).toBe('OWNER');
    expect(auditActions).toEqual(['CREATE', 'ASSIGN']);
  });

  it('reuses an existing compatible occupant user', async () => {
    let insertedUser = false;
    let assignmentInsertParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [] };
      if (sql.includes('FROM users')) {
        return {
          rows: [
            {
              id: 'u_existing_tenant',
              email: 'tenant.existing@propsys.com',
              name: 'Tenant Existente',
              internal_role: 'OCCUPANT',
              client_id: 'client_001',
              scope: 'client',
              status: 'ACTIVE',
            },
          ],
        };
      }
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO users')) insertedUser = true;
      if (sql.includes('INSERT INTO user_unit_assignments')) {
        assignmentInsertParams = params ?? null;
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/unit-assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        unitId: 'unit-103',
        assignmentType: 'OCCUPANT',
        name: 'Tenant Existente',
        email: 'tenant.existing@propsys.com',
      }),
    });

    const res = await assignUnitUser(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { user?: { id: string }; tempPassword?: string };
    expect(data.user?.id).toBe('u_existing_tenant');
    expect(data.tempPassword).toBeUndefined();
    expect(insertedUser).toBe(false);
    expect(assignmentInsertParams?.[2]).toBe('u_existing_tenant');
    expect(assignmentInsertParams?.[4]).toBe('OCCUPANT');
  });

  it('marks the active owner as resident without creating a second user', async () => {
    let insertedUser = false;
    let assignmentInsertParams: unknown[] | null = null;
    let auditMetadata: unknown = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments') && !sql.includes('JOIN users')) return { rows: [] };
      if (sql.includes('JOIN users')) {
        return {
          rows: [
            {
              id: 'u_owner_existing',
              email: 'owner.existing@propsys.com',
              name: 'Owner Existente',
              internal_role: 'OWNER',
              client_id: 'client_001',
              scope: 'client',
              status: 'ACTIVE',
            },
          ],
        };
      }
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO users')) insertedUser = true;
      if (sql.includes('INSERT INTO user_unit_assignments')) {
        assignmentInsertParams = params ?? null;
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        auditMetadata = params?.[6];
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/unit-assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        unitId: 'unit-103',
        assignmentType: 'OCCUPANT',
        ownerAsResident: true,
      }),
    });

    const res = await assignUnitUser(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      user?: { id: string; internalRole: string; unitId: string };
      assignmentType?: string;
      ownerAsResident?: boolean;
      tempPassword?: string;
    };
    expect(data.user?.id).toBe('u_owner_existing');
    expect(data.user?.internalRole).toBe('OWNER');
    expect(data.user?.unitId).toBe('unit-103');
    expect(data.assignmentType).toBe('OCCUPANT');
    expect(data.ownerAsResident).toBe(true);
    expect(data.tempPassword).toBeUndefined();
    expect(insertedUser).toBe(false);
    expect(assignmentInsertParams?.[2]).toBe('u_owner_existing');
    expect(JSON.parse(String(auditMetadata))).toMatchObject({ ownerAsResident: true, assignmentType: 'OCCUPANT' });
  });

  it('blocks assigning a unit slot that is already occupied', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ id: 'uua_existing' }] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/unit-assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        unitId: 'unit-103',
        assignmentType: 'OCCUPANT',
        name: 'Tenant Nuevo',
        email: 'tenant.new@propsys.com',
      }),
    });

    const res = await assignUnitUser(req);
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('La unidad ya tiene inquilino asignado.');
    expect(connect).not.toHaveBeenCalled();
  });

  it('liberates the active resident slot without deleting the user', async () => {
    let updateParams: unknown[] | null = null;
    let auditParams: unknown[] | null = null;

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ id: 'uua_resident', user_id: 'u_tenant' }] };
      return { rows: [] };
    });

    clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE user_unit_assignments')) {
        updateParams = params ?? null;
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO audit_logs')) {
        auditParams = params ?? null;
        return { rows: [] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/unit-assignments', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ unitId: 'unit-103' }),
    });

    const res = await unassignUnitResident(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { unitId?: string; assignmentType?: string; userId?: string };
    expect(data.unitId).toBe('unit-103');
    expect(data.assignmentType).toBe('OCCUPANT');
    expect(data.userId).toBe('u_tenant');
    expect(updateParams?.[0]).toBe('uua_resident');
    expect(auditParams?.[3]).toBe('UNASSIGN');
    expect(auditParams?.[4]).toBe('Unit');
  });

  it('blocks reusing an email from another role or tenant', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [] };
      if (sql.includes('FROM users')) {
        return {
          rows: [
            {
              id: 'u_staff',
              email: 'staff@propsys.com',
              name: 'Staff Operativo',
              internal_role: 'STAFF',
              client_id: 'client_001',
              scope: 'building',
              status: 'ACTIVE',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/physical/unit-assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        unitId: 'unit-103',
        assignmentType: 'OCCUPANT',
        name: 'Staff Operativo',
        email: 'staff@propsys.com',
      }),
    });

    const res = await assignUnitUser(req);
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Ese email ya existe con otro rol o cliente.');
    expect(connect).not.toHaveBeenCalled();
  });
});
