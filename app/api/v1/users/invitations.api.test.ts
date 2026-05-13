import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashAccountToken } from '@/lib/server/auth/account-token';
import { POST as createInvitation } from './invitations/route';

const poolQuery = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));
const emailMocks = vi.hoisted(() => ({
  configured: true,
  exposeDebugLinks: true,
  sendInvitationEmail: vi.fn(),
}));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query: poolQuery,
    connect,
  }),
}));

vi.mock('@/lib/server/email/resend', () => ({
  isEmailProviderConfigured: () => emailMocks.configured,
  sendInvitationEmail: emailMocks.sendInvitationEmail,
  shouldExposeEmailDebugLinks: () => emailMocks.exposeDebugLinks,
}));

const sessionUser = {
  id: 'u_mgr',
  clientId: 'client_001' as string | null,
  email: 'manager@propsys.com',
  name: 'Gestora Principal',
  role: 'MANAGER',
  internalRole: 'CLIENT_MANAGER',
  scope: 'client',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/v1/users/invitations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function unitRow(clientId = 'client_001') {
  return {
    id: 'unit-101',
    client_id: clientId,
    building_id: 'b1',
  };
}

function mockSuccessfulTransaction() {
  let userInsertSql = '';
  let userInsertParams: unknown[] | null = null;
  let invitationInsertParams: unknown[] | null = null;
  const auditPayloads: string[] = [];

  clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
    if (sql.includes('INSERT INTO users')) {
      userInsertSql = sql;
      userInsertParams = params ?? null;
      return {
        rows: [
          {
            id: params?.[0] as string,
            email: params?.[2] as string,
            name: params?.[4] as string,
            internal_role: params?.[6] as string,
            client_id: params?.[1] as string,
            scope: 'client',
            status: 'INACTIVE',
          },
        ],
      };
    }
    if (sql.includes('INSERT INTO user_unit_assignments')) return { rows: [] };
    if (sql.includes('INSERT INTO user_building_assignments')) return { rows: [] };
    if (sql.includes('INSERT INTO user_invitations')) {
      invitationInsertParams = params ?? null;
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO audit_logs')) {
      auditPayloads.push(JSON.stringify(params ?? []));
      return { rows: [] };
    }
    return { rows: [] };
  });

  return {
    getUserInsertSql: () => userInsertSql,
    getUserInsertParams: () => userInsertParams,
    getInvitationInsertParams: () => invitationInsertParams,
    getAuditPayloads: () => auditPayloads,
  };
}

describe('POST /api/v1/users/invitations', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    vi.unstubAllEnvs();
    vi.stubEnv('PROPSYS_APP_URL', 'https://app.propsys.test');
    emailMocks.configured = true;
    emailMocks.exposeDebugLinks = true;
    emailMocks.sendInvitationEmail.mockReset();
    emailMocks.sendInvitationEmail.mockResolvedValue(undefined);
    sessionUser.id = 'u_mgr';
    sessionUser.clientId = 'client_001';
    sessionUser.internalRole = 'CLIENT_MANAGER';
    sessionUser.scope = 'client';
  });

  it('allows CLIENT_MANAGER to invite an OWNER for a unit in their tenant', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [] };
      if (sql.includes('FROM users')) return { rows: [] };
      return { rows: [] };
    });
    const tx = mockSuccessfulTransaction();

    const res = await createInvitation(
      makeRequest({
        email: ' Owner.New@Example.com ',
        name: 'Owner Nuevo',
        internalRole: 'OWNER',
        unitId: 'unit-101',
        clientId: 'client_malicious',
      })
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      user?: { status: string; clientId: string; internalRole: string; unitId?: string };
      invitation?: { status: string };
      delivery?: { mode: string; inviteLink: string; token?: string };
    };
    expect(data.user).toMatchObject({
      status: 'INACTIVE',
      clientId: 'client_001',
      internalRole: 'OWNER',
      unitId: 'unit-101',
    });
    expect(data.invitation?.status).toBe('PENDING');
    expect(data.delivery?.mode).toBe('resend');
    expect(data.delivery?.inviteLink).toMatch(/^https:\/\/app\.propsys\.test\/invitations\/accept\?token=/);
    expect(data.delivery?.token).toBeUndefined();

    const rawToken = new URL(data.delivery?.inviteLink ?? '').searchParams.get('token') ?? '';
    expect(rawToken).toBeTruthy();
    expect(tx.getUserInsertSql()).toContain("'INACTIVE'");
    expect(tx.getUserInsertParams()?.[1]).toBe('client_001');
    expect(tx.getUserInsertParams()?.[2]).toBe('owner.new@example.com');
    expect(tx.getUserInsertParams()?.[3]).toBeNull();
    expect(tx.getInvitationInsertParams()?.[6]).toBe('PENDING');
    expect(tx.getInvitationInsertParams()?.[5]).toBe(hashAccountToken(rawToken));
    expect(JSON.stringify(tx.getInvitationInsertParams())).not.toContain(rawToken);
    expect(tx.getAuditPayloads().join('\n')).not.toContain(rawToken);
    expect(tx.getAuditPayloads().join('\n')).not.toContain('password');
    expect(emailMocks.sendInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner.new@example.com',
        inviteLink: expect.stringContaining('https://app.propsys.test/invitations/accept?token='),
      })
    );
  });

  it('rejects a unit outside the manager tenant', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow('client_002')] };
      return { rows: [] };
    });

    const res = await createInvitation(
      makeRequest({
        email: 'owner.new@example.com',
        name: 'Owner Nuevo',
        internalRole: 'OWNER',
        unitId: 'unit-101',
      })
    );

    expect(res.status).toBe(404);
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects duplicate active OWNER/OCCUPANT slots', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM units u')) return { rows: [unitRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ id: 'uua_existing' }] };
      return { rows: [] };
    });

    const res = await createInvitation(
      makeRequest({
        email: 'owner.new@example.com',
        name: 'Owner Nuevo',
        internalRole: 'OWNER',
        unitId: 'unit-101',
      })
    );

    expect(res.status).toBe(409);
    expect(connect).not.toHaveBeenCalled();
  });

  it('allows BUILDING_ADMIN to invite STAFF only for assigned buildings', async () => {
    sessionUser.id = 'u_building_admin';
    sessionUser.internalRole = 'BUILDING_ADMIN';

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM buildings')) return { rows: [{ id: 'b1', client_id: 'client_001' }] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      if (sql.includes('FROM users')) return { rows: [] };
      return { rows: [] };
    });
    const tx = mockSuccessfulTransaction();

    const res = await createInvitation(
      makeRequest({
        email: 'staff.new@example.com',
        name: 'Staff Nuevo',
        internalRole: 'STAFF',
        buildingId: 'b1',
      })
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { user?: { internalRole: string; buildingId?: string } };
    expect(data.user).toMatchObject({ internalRole: 'STAFF', buildingId: 'b1' });
    expect(tx.getUserInsertParams()?.[6]).toBe('STAFF');
  });

  it('rejects BUILDING_ADMIN invitations for residents', async () => {
    sessionUser.internalRole = 'BUILDING_ADMIN';

    const res = await createInvitation(
      makeRequest({
        email: 'owner.new@example.com',
        name: 'Owner Nuevo',
        internalRole: 'OWNER',
        unitId: 'unit-101',
      })
    );

    expect(res.status).toBe(403);
    expect(connect).not.toHaveBeenCalled();
  });

  it.each(['STAFF', 'OWNER', 'OCCUPANT'])('rejects %s actors', async (role) => {
    sessionUser.internalRole = role;

    const res = await createInvitation(
      makeRequest({
        email: 'staff.new@example.com',
        name: 'Staff Nuevo',
        internalRole: 'STAFF',
        buildingId: 'b1',
      })
    );

    expect(res.status).toBe(403);
    expect(connect).not.toHaveBeenCalled();
  });

  it('does not expose raw tokens in production without an explicit flag', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    emailMocks.configured = false;
    emailMocks.exposeDebugLinks = false;

    const res = await createInvitation(
      makeRequest({
        email: 'owner.new@example.com',
        name: 'Owner Nuevo',
        internalRole: 'OWNER',
        unitId: 'unit-101',
      })
    );

    expect(res.status).toBe(503);
    const data = (await res.json()) as { delivery?: unknown; token?: unknown; inviteLink?: unknown };
    expect(data.delivery).toBeUndefined();
    expect(data.token).toBeUndefined();
    expect(data.inviteLink).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
  });
});
