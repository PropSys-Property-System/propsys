import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as changePassword } from './change-password/route';

// ── Rate limit mock ────────────────────────────────────────────────────────
const rateLimitMocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetAt: new Date() })),
  resetRateLimitBucket: vi.fn(async () => undefined),
  getClientIp: vi.fn(() => '203.0.113.10'),
  hashRateLimitKey: vi.fn((ns: string, val: string) => `${ns}:${val}`),
  rateLimitExceededHeaders: vi.fn((s: number) => ({ 'Retry-After': String(s), 'Cache-Control': 'no-store' })),
}));

vi.mock('@/lib/server/security/rate-limit', () => rateLimitMocks);

// ── argon2 mock ────────────────────────────────────────────────────────────
const argon2Mocks = vi.hoisted(() => ({
  verify: vi.fn(async () => true),
  hash: vi.fn(async () => '$argon2id$newhash'),
}));

vi.mock('argon2', () => ({
  default: argon2Mocks,
  verify: argon2Mocks.verify,
  hash: argon2Mocks.hash,
}));

// ── DB mock ────────────────────────────────────────────────────────────────
const poolQuery = vi.fn();

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({ query: poolQuery }),
}));

// ── Audit log mock ─────────────────────────────────────────────────────────
vi.mock('@/lib/server/audit/audit-log', () => ({
  insertAuditLog: vi.fn(async () => undefined),
}));

// ── Session mock ───────────────────────────────────────────────────────────
const sessionUser = {
  id: 'u_test',
  clientId: 'client_001' as string | null,
  email: 'user@propsys.com',
  name: 'Test User',
  role: 'OWNER',
  internalRole: 'OWNER',
  scope: 'client',
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

function makeRequest(body: Record<string, string>) {
  return new Request('http://localhost/api/auth/change-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/change-password', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    rateLimitMocks.checkRateLimit.mockReset();
    rateLimitMocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: new Date() });
    argon2Mocks.verify.mockReset();
    argon2Mocks.verify.mockResolvedValue(true);
    argon2Mocks.hash.mockReset();
    argon2Mocks.hash.mockResolvedValue('$argon2id$newhash');
    sessionUser.id = 'u_test';
    sessionUser.clientId = 'client_001';
  });

  it('changes password successfully', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: '$argon2id$current' }] }) // SELECT
      .mockResolvedValueOnce({ rows: [] }); // UPDATE

    const res = await changePassword(makeRequest({
      currentPassword: 'OldPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    }));

    expect(res.status).toBe(200);
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
    expect(argon2Mocks.verify).toHaveBeenCalledOnce();
    expect(argon2Mocks.hash).toHaveBeenCalledOnce();
    // Ensure hash is not returned
    expect(JSON.stringify(data)).not.toContain('argon2id');
  });

  it('rejects when current password is incorrect', async () => {
    argon2Mocks.verify.mockResolvedValue(false);
    poolQuery.mockResolvedValueOnce({ rows: [{ password_hash: '$argon2id$current' }] });

    const res = await changePassword(makeRequest({
      currentPassword: 'WrongPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    }));

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('incorrecta');
    expect(poolQuery.mock.calls.some(([sql]) => typeof sql === 'string' && sql.startsWith('UPDATE'))).toBe(false);
  });

  it('rejects when new password and confirmation do not match', async () => {
    const res = await changePassword(makeRequest({
      currentPassword: 'OldPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'DifferentPass1',
    }));

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('coinciden');
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('rejects when new password does not meet policy', async () => {
    const res = await changePassword(makeRequest({
      currentPassword: 'OldPass1',
      newPassword: 'short',
      confirmPassword: 'short',
    }));

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain('8 caracteres');
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('rejects when user is not authenticated', async () => {
    const { getSessionUser } = await import('@/lib/server/auth/get-session-user');
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);

    const res = await changePassword(makeRequest({
      currentPassword: 'OldPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    }));

    expect(res.status).toBe(401);
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limit is exceeded and does not update DB', async () => {
    rateLimitMocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 3600_000),
      retryAfter: 3600,
    });

    const res = await changePassword(makeRequest({
      currentPassword: 'OldPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    }));

    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(poolQuery).not.toHaveBeenCalled();
  });

  it('does not return password_hash or sensitive data in response', async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [{ password_hash: '$argon2id$supersecret' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await changePassword(makeRequest({
      currentPassword: 'OldPass1',
      newPassword: 'NewPass1',
      confirmPassword: 'NewPass1',
    }));

    const body = await res.text();
    expect(body).not.toContain('password_hash');
    expect(body).not.toContain('supersecret');
    expect(body).not.toContain('argon2id');
  });
});
