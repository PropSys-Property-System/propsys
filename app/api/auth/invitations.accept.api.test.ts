import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashAccountToken } from '@/lib/server/auth/account-token';
import { POST as acceptInvitation } from './invitations/accept/route';

// ── Rate limit mock ────────────────────────────────────────────────────────
const rateLimitMocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 29, resetAt: new Date() })),
  resetRateLimitBucket: vi.fn(async () => undefined),
  getClientIp: vi.fn(() => '203.0.113.10'),
  hashRateLimitKey: vi.fn((ns: string, val: string) => `${ns}:${val}`),
  rateLimitExceededHeaders: vi.fn((s: number) => ({ 'Retry-After': String(s), 'Cache-Control': 'no-store' })),
}));

vi.mock('@/lib/server/security/rate-limit', () => rateLimitMocks);

// ── DB mocks ───────────────────────────────────────────────────────────────
const poolQuery = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));

vi.mock('argon2', () => ({
  default: {
    argon2id: 2,
    hash: vi.fn(async () => 'argon_hash_value'),
  },
}));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query: poolQuery,
    connect,
  }),
}));

const VALID_TOKEN = 'raw-invitation-token';
const VALID_PASSWORD = 'StrongPassword#2026';

function makeRequest(body: Record<string, unknown>, ip = '203.0.113.10') {
  return new Request('http://localhost/api/auth/invitations/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

function invitationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv_001',
    client_id: 'client_001',
    user_id: 'u_invited',
    email: 'owner@example.com',
    token_hash: hashAccountToken(VALID_TOKEN),
    status: 'PENDING',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    accepted_at: null,
    revoked_at: null,
    user_status: 'INACTIVE',
    password_hash: null,
    ...overrides,
  };
}

function mockInvitationTransaction(row: ReturnType<typeof invitationRow> | null) {
  const updates: string[] = [];
  const updateParams: unknown[][] = [];
  const auditPayloads: string[] = [];

  clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
    if (sql.includes('FROM user_invitations')) {
      expect(params?.[0]).toBe(hashAccountToken(VALID_TOKEN));
      return { rows: row ? [row] : [] };
    }
    if (sql.includes('UPDATE users')) {
      updates.push('users');
      updateParams.push(params ?? []);
      return { rows: [] };
    }
    if (sql.includes('UPDATE user_invitations')) {
      updates.push('user_invitations');
      updateParams.push(params ?? []);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO audit_logs')) {
      auditPayloads.push(JSON.stringify(params ?? []));
      return { rows: [] };
    }
    return { rows: [] };
  });

  return {
    getUpdates: () => updates,
    getUpdateParams: () => updateParams,
    getAuditPayloads: () => auditPayloads,
  };
}

describe('POST /api/auth/invitations/accept', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    vi.mocked(argon2.hash).mockClear();
    rateLimitMocks.checkRateLimit.mockReset();
    rateLimitMocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetAt: new Date() });
  });

  it('accepts a valid pending invitation, activates the user and does not create a session', async () => {
    const tx = mockInvitationTransaction(invitationRow());

    const res = await acceptInvitation(makeRequest({ token: VALID_TOKEN, password: VALID_PASSWORD }));

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok?: boolean };
    expect(data.ok).toBe(true);
    expect(res.cookies.get('ps_session')).toBeUndefined();
    expect(argon2.hash).toHaveBeenCalledWith(VALID_PASSWORD, { type: argon2.argon2id });
    expect(tx.getUpdates()).toEqual(['users', 'user_invitations']);
    expect(tx.getUpdateParams()[0]).toEqual(['u_invited', 'argon_hash_value', expect.any(String)]);
    expect(tx.getUpdateParams()[1]).toEqual(['inv_001', expect.any(String)]);
    expect(tx.getAuditPayloads().join('\n')).not.toContain(VALID_TOKEN);
    expect(tx.getAuditPayloads().join('\n')).not.toContain(VALID_PASSWORD);
    expect(tx.getAuditPayloads().join('\n')).not.toContain('argon_hash_value');
  });

  it('rate limits invitation accept by IP and returns 429 with Retry-After', async () => {
    rateLimitMocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 600_000),
      retryAfter: 600,
    });

    const res = await acceptInvitation(makeRequest({ token: VALID_TOKEN, password: VALID_PASSWORD }));

    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    // DB must NOT be touched
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects weak passwords before opening a transaction', async () => {
    const res = await acceptInvitation(makeRequest({ token: VALID_TOKEN, password: 'weak' }));

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('La contrasena debe tener al menos 12 caracteres e incluir mayuscula, minuscula, numero y simbolo.');
    expect(connect).not.toHaveBeenCalled();
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('rejects invalid tokens with a generic response', async () => {
    mockInvitationTransaction(null);

    const res = await acceptInvitation(makeRequest({ token: VALID_TOKEN, password: VALID_PASSWORD }));

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Invitacion invalida o expirada.');
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('rejects expired invitations without updating user or invitation', async () => {
    const tx = mockInvitationTransaction(invitationRow({ expires_at: new Date(Date.now() - 1000).toISOString() }));

    const res = await acceptInvitation(makeRequest({ token: VALID_TOKEN, password: VALID_PASSWORD }));

    expect(res.status).toBe(400);
    expect(tx.getUpdates()).toEqual([]);
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('rejects accepted/revoked invitations and prevents replay', async () => {
    const tx = mockInvitationTransaction(invitationRow({ status: 'ACCEPTED', accepted_at: new Date().toISOString() }));

    const res = await acceptInvitation(makeRequest({ token: VALID_TOKEN, password: VALID_PASSWORD }));

    expect(res.status).toBe(400);
    expect(tx.getUpdates()).toEqual([]);
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('rejects invitations whose user is already active', async () => {
    const tx = mockInvitationTransaction(invitationRow({ user_status: 'ACTIVE', password_hash: 'existing_hash' }));

    const res = await acceptInvitation(makeRequest({ token: VALID_TOKEN, password: VALID_PASSWORD }));

    expect(res.status).toBe(400);
    expect(tx.getUpdates()).toEqual([]);
    expect(argon2.hash).not.toHaveBeenCalled();
  });
});
