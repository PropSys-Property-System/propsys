import argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashAccountToken } from '@/lib/server/auth/account-token';
import { POST as confirmPasswordReset } from './password-reset/confirm/route';
import { POST as requestPasswordReset } from './password-reset/request/route';

const poolQuery = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));
const emailMocks = vi.hoisted(() => ({
  configured: true,
  exposeDebugLinks: true,
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('argon2', () => ({
  default: {
    argon2id: 2,
    hash: vi.fn(async () => 'argon_reset_hash'),
  },
}));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query: poolQuery,
    connect,
  }),
}));

vi.mock('@/lib/server/email/resend', () => ({
  isEmailProviderConfigured: () => emailMocks.configured,
  sendPasswordResetEmail: emailMocks.sendPasswordResetEmail,
  shouldExposeEmailDebugLinks: () => emailMocks.exposeDebugLinks,
}));

const VALID_TOKEN = 'raw-reset-token';
const VALID_PASSWORD = 'StrongPassword#2026';

function requestReset(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/password-reset/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function confirmReset(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/password-reset/confirm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function activeUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u_active',
    client_id: 'client_001',
    email: 'active@example.com',
    status: 'ACTIVE',
    password_hash: 'existing_hash',
    ...overrides,
  };
}

function resetTokenRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'prt_001',
    client_id: 'client_001',
    user_id: 'u_active',
    email: 'active@example.com',
    token_hash: hashAccountToken(VALID_TOKEN),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    used_at: null,
    revoked_at: null,
    user_status: 'ACTIVE',
    ...overrides,
  };
}

function mockRequestTransaction() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const auditPayloads: string[] = [];

  clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
    calls.push({ sql, params: params ?? [] });
    if (sql.includes('INSERT INTO audit_logs')) auditPayloads.push(JSON.stringify(params ?? []));
    return { rows: [] };
  });

  return {
    calls,
    auditPayloads,
    insertedTokenParams: () => calls.find((call) => call.sql.includes('INSERT INTO password_reset_tokens'))?.params,
    revokedTokenParams: () => calls.find((call) => call.sql.includes('UPDATE password_reset_tokens'))?.params,
  };
}

function mockConfirmTransaction(row: ReturnType<typeof resetTokenRow> | null) {
  const updates: string[] = [];
  const updateParams: unknown[][] = [];
  const auditPayloads: string[] = [];

  clientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
    if (sql.includes('FROM password_reset_tokens')) {
      expect(params?.[0]).toBe(hashAccountToken(VALID_TOKEN));
      return { rows: row ? [row] : [] };
    }
    if (sql.includes('UPDATE users')) {
      updates.push('users');
      updateParams.push(params ?? []);
      return { rows: [] };
    }
    if (sql.includes('UPDATE password_reset_tokens')) {
      updates.push('password_reset_tokens');
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
    updates,
    updateParams,
    auditPayloads,
  };
}

describe('password reset backend', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    vi.mocked(argon2.hash).mockClear();
    vi.unstubAllEnvs();
    vi.stubEnv('PROPSYS_APP_URL', 'https://app.propsys.test');
    emailMocks.configured = true;
    emailMocks.exposeDebugLinks = true;
    emailMocks.sendPasswordResetEmail.mockReset();
    emailMocks.sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it('creates a reset token for an active user and exposes the dev link without returning tokenHash', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const tx = mockRequestTransaction();
    poolQuery.mockResolvedValueOnce({ rows: [activeUserRow()] });

    const res = await requestPasswordReset(requestReset({ email: 'Active@Example.com' }));

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const data = (await res.json()) as {
      ok?: boolean;
      delivery?: { mode?: string; resetLink?: string; tokenHash?: string };
    };
    expect(data.ok).toBe(true);
    expect(data.delivery?.mode).toBe('resend');
    expect(data.delivery?.resetLink).toMatch(/^https:\/\/app\.propsys\.test\/reset-password\?token=/);
    expect(data.delivery?.tokenHash).toBeUndefined();

    const rawToken = new URL(data.delivery?.resetLink ?? '').searchParams.get('token') ?? '';
    expect(rawToken).toBeTruthy();
    const insertParams = tx.insertedTokenParams();
    expect(insertParams?.[1]).toBe('client_001');
    expect(insertParams?.[2]).toBe('u_active');
    expect(insertParams?.[3]).toBe('active@example.com');
    expect(insertParams?.[4]).toBe(hashAccountToken(rawToken));
    expect(insertParams?.[4]).not.toBe(rawToken);
    expect(tx.revokedTokenParams()?.[0]).toBe('u_active');
    expect(tx.auditPayloads.join('\n')).not.toContain(rawToken);
    expect(tx.auditPayloads.join('\n')).not.toContain(String(insertParams?.[4]));
    expect(emailMocks.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'active@example.com',
        resetLink: expect.stringContaining('https://app.propsys.test/reset-password?token='),
      })
    );
  });

  it('returns a generic ok response for unknown emails without creating a token', async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] });

    const res = await requestPasswordReset(requestReset({ email: 'missing@example.com' }));

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok?: boolean; delivery?: unknown };
    expect(data.ok).toBe(true);
    expect(data.delivery).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
  });

  it('does not expose or create reset tokens in production without explicit token exposure', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PROPSYS_EXPOSE_AUTH_TOKENS', '');
    emailMocks.configured = false;
    emailMocks.exposeDebugLinks = false;

    const res = await requestPasswordReset(requestReset({ email: 'active@example.com' }));

    expect(res.status).toBe(503);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe(
      'No hay proveedor de correo configurado para enviar recuperacion de contrasena. Reemplaza re_xxxxxxxxx por tu API key real de Resend.'
    );
    expect(poolQuery).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('confirms a valid reset token, updates the password and does not create a session', async () => {
    const tx = mockConfirmTransaction(resetTokenRow());

    const res = await confirmPasswordReset(confirmReset({ token: VALID_TOKEN, password: VALID_PASSWORD }));

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok?: boolean };
    expect(data.ok).toBe(true);
    expect(res.cookies.get('ps_session')).toBeUndefined();
    expect(argon2.hash).toHaveBeenCalledWith(VALID_PASSWORD, { type: argon2.argon2id });
    expect(tx.updates).toEqual(['users', 'password_reset_tokens']);
    expect(tx.updateParams[0]).toEqual(['u_active', 'argon_reset_hash', expect.any(String)]);
    expect(tx.updateParams[1]).toEqual(['prt_001', expect.any(String)]);
    expect(tx.auditPayloads.join('\n')).not.toContain(VALID_TOKEN);
    expect(tx.auditPayloads.join('\n')).not.toContain(VALID_PASSWORD);
    expect(tx.auditPayloads.join('\n')).not.toContain('argon_reset_hash');
  });

  it('rejects weak reset passwords before opening a transaction', async () => {
    const res = await confirmPasswordReset(confirmReset({ token: VALID_TOKEN, password: 'weak' }));

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('La contrasena debe tener al menos 12 caracteres e incluir mayuscula, minuscula, numero y simbolo.');
    expect(connect).not.toHaveBeenCalled();
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('rejects invalid reset tokens with a generic response', async () => {
    const tx = mockConfirmTransaction(null);

    const res = await confirmPasswordReset(confirmReset({ token: VALID_TOKEN, password: VALID_PASSWORD }));

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Reset invalido o expirado.');
    expect(tx.updates).toEqual([]);
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('rejects expired, used or revoked tokens without updating the user', async () => {
    const tx = mockConfirmTransaction(resetTokenRow({ expires_at: new Date(Date.now() - 1000).toISOString() }));

    const res = await confirmPasswordReset(confirmReset({ token: VALID_TOKEN, password: VALID_PASSWORD }));

    expect(res.status).toBe(400);
    expect(tx.updates).toEqual([]);
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('rejects reset tokens for inactive users', async () => {
    const tx = mockConfirmTransaction(resetTokenRow({ user_status: 'INACTIVE' }));

    const res = await confirmPasswordReset(confirmReset({ token: VALID_TOKEN, password: VALID_PASSWORD }));

    expect(res.status).toBe(400);
    expect(tx.updates).toEqual([]);
    expect(argon2.hash).not.toHaveBeenCalled();
  });
});
