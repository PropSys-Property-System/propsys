import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as unassignUnitResident, POST as assignUnitUser } from './unit-assignments/route';

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

type TestInternalRole = 'ROOT_ADMIN' | 'CLIENT_MANAGER' | 'BUILDING_ADMIN' | 'STAFF' | 'OWNER' | 'OCCUPANT';

const sessionUser = {
  id: 'u_mgr',
  clientId: 'client_001' as string | null,
  email: 'manager@propsys.com',
  name: 'Gestora Principal',
  role: 'MANAGER',
  internalRole: 'CLIENT_MANAGER' as TestInternalRole,
  scope: 'client' as 'client' | 'platform',
  status: 'ACTIVE' as const,
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

function setSessionRole(internalRole: TestInternalRole) {
  sessionUser.id = internalRole === 'ROOT_ADMIN' ? 'u_root' : 'u_mgr';
  sessionUser.clientId = internalRole === 'ROOT_ADMIN' ? null : 'client_001';
  sessionUser.internalRole = internalRole;
  sessionUser.scope = internalRole === 'ROOT_ADMIN' ? 'platform' : 'client';
}

function unitRow(clientId = 'client_001') {
  return {
    id: 'unit-103',
    client_id: clientId,
    building_id: 'b1',
    number: '103',
  };
}

function ownerUser(clientId = 'client_001') {
  return {
    id: 'u_owner_existing',
    email: 'owner.existing@propsys.com',
    name: 'Owner Existente',
    internal_role: 'OWNER',
    client_id: clientId,
    scope: 'client',
    status: 'ACTIVE',
  };
}

function occupantUser(clientId = 'client_001') {
  return {
    id: 'u_occupant_existing',
    email: 'tenant.existing@propsys.com',
    name: 'Tenant Existente',
    internal_role: 'OCCUPANT',
    client_id: clientId,
    scope: 'client',
    status: 'ACTIVE',
  };
}

function assignRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/v1/physical/unit-assignments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ unitId: 'unit-103', ...body }),
  });
}

function mockAssignmentTransaction() {
  const state = {
    insertedUser: false,
    assignmentInsertParams: null as unknown[] | null,
    auditActions: [] as unknown[],
    auditMetadata: [] as unknown[],
  };

  clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
    if (sql.includes('INSERT INTO users')) {
      state.insertedUser = true;
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO user_unit_assignments')) {
      state.assignmentInsertParams = params ?? null;
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO audit_logs')) {
      state.auditActions.push(params?.[3]);
      state.auditMetadata.push(params?.[6]);
      return { rows: [] };
    }
    return { rows: [] };
  });

  return state;
}

describe('physical unit assignments API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    vi.mocked(argon2.hash).mockClear();
    setSessionRole('CLIENT_MANAGER');
  });

  it('assigns an existing active owner to an accessible unit without creating a user or temp password', async () => {
    const tx = mockAssignmentTransaction();
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [] };
      if (sql.includes('FROM users')) return { rows: [ownerUser()] };
      return { rows: [] };
    });

    const res = await assignUnitUser(
      assignRequest({
        assignmentType: 'OWNER',
        email: 'owner.existing@propsys.com',
        password: 'IgnoredPassword#2026',
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBeNull();
    const data = (await res.json()) as { user?: { id: string; internalRole: string; unitId: string }; tempPassword?: string };
    expect(data.user).toMatchObject({ id: 'u_owner_existing', internalRole: 'OWNER', unitId: 'unit-103' });
    expect(data.tempPassword).toBeUndefined();
    expect(tx.insertedUser).toBe(false);
    expect(tx.assignmentInsertParams?.[2]).toBe('u_owner_existing');
    expect(tx.assignmentInsertParams?.[4]).toBe('OWNER');
    expect(tx.auditActions).toEqual(['ASSIGN']);
    expect(String(tx.auditMetadata.join(' '))).not.toContain('IgnoredPassword#2026');
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('assigns an existing active occupant to an accessible unit', async () => {
    const tx = mockAssignmentTransaction();
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [] };
      if (sql.includes('FROM users')) return { rows: [occupantUser()] };
      return { rows: [] };
    });

    const res = await assignUnitUser(assignRequest({ assignmentType: 'OCCUPANT', email: 'tenant.existing@propsys.com' }));

    expect(res.status).toBe(200);
    const data = (await res.json()) as { user?: { id: string; internalRole: string }; assignmentType?: string; tempPassword?: string };
    expect(data.user).toMatchObject({ id: 'u_occupant_existing', internalRole: 'OCCUPANT' });
    expect(data.assignmentType).toBe('OCCUPANT');
    expect(data.tempPassword).toBeUndefined();
    expect(tx.insertedUser).toBe(false);
    expect(tx.assignmentInsertParams?.[2]).toBe('u_occupant_existing');
    expect(tx.assignmentInsertParams?.[4]).toBe('OCCUPANT');
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('marks the active owner as resident without creating a second user', async () => {
    const tx = mockAssignmentTransaction();
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments') && !sql.includes('JOIN users')) return { rows: [] };
      if (sql.includes('JOIN users')) return { rows: [ownerUser()] };
      return { rows: [] };
    });

    const res = await assignUnitUser(assignRequest({ assignmentType: 'OCCUPANT', ownerAsResident: true }));

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      user?: { id: string; internalRole: string; unitId: string };
      assignmentType?: string;
      ownerAsResident?: boolean;
      tempPassword?: string;
    };
    expect(data.user).toMatchObject({ id: 'u_owner_existing', internalRole: 'OWNER', unitId: 'unit-103' });
    expect(data.assignmentType).toBe('OCCUPANT');
    expect(data.ownerAsResident).toBe(true);
    expect(data.tempPassword).toBeUndefined();
    expect(tx.insertedUser).toBe(false);
    expect(tx.assignmentInsertParams?.[2]).toBe('u_owner_existing');
    expect(JSON.parse(String(tx.auditMetadata[0]))).toMatchObject({ ownerAsResident: true, assignmentType: 'OCCUPANT' });
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('rejects assigning a user that does not exist and does not create a replacement user', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [] };
      if (sql.includes('FROM users')) return { rows: [] };
      return { rows: [] };
    });

    const res = await assignUnitUser(
      assignRequest({
        assignmentType: 'OWNER',
        email: 'new.owner@propsys.com',
        name: 'Owner Nuevo',
        password: 'StrongOwner#2026',
      })
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as { error?: string; tempPassword?: string };
    expect(data.error).toBe('Usuario no encontrado. Invítalo primero.');
    expect(data.tempPassword).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('blocks assigning a unit slot that is already occupied', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ id: 'uua_existing' }] };
      return { rows: [] };
    });

    const res = await assignUnitUser(assignRequest({ assignmentType: 'OCCUPANT', email: 'tenant.existing@propsys.com' }));

    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('La unidad ya tiene inquilino asignado.');
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects an existing user from another tenant without revealing cross-tenant details', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [] };
      if (sql.includes('FROM users')) return { rows: [ownerUser('client_002')] };
      return { rows: [] };
    });

    const res = await assignUnitUser(assignRequest({ assignmentType: 'OWNER', email: 'owner.existing@propsys.com' }));

    expect(res.status).toBe(404);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Usuario no encontrado. Invítalo primero.');
    expect(connect).not.toHaveBeenCalled();
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('rejects an existing user with an incompatible role', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [] };
      if (sql.includes('FROM users')) return { rows: [occupantUser()] };
      return { rows: [] };
    });

    const res = await assignUnitUser(assignRequest({ assignmentType: 'OWNER', email: 'tenant.existing@propsys.com' }));

    expect(res.status).toBe(409);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('El usuario existente no tiene un rol compatible para esta asignacion.');
    expect(connect).not.toHaveBeenCalled();
  });

  it.each(['BUILDING_ADMIN', 'STAFF', 'OWNER', 'OCCUPANT'] as const)('rejects %s actors from assigning residents', async (role) => {
    setSessionRole(role);

    const res = await assignUnitUser(assignRequest({ assignmentType: 'OWNER', email: 'owner.existing@propsys.com' }));

    expect(res.status).toBe(403);
    expect(poolQuery).not.toHaveBeenCalled();
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
});
