import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Rate limit mock ────────────────────────────────────────────────────────
const rateLimitMocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 19, resetAt: new Date() })),
  resetRateLimitBucket: vi.fn(async () => undefined),
  getClientIp: vi.fn(() => '203.0.113.10'),
  hashRateLimitKey: vi.fn((ns: string, val: string) => `${ns}:${val}`),
  rateLimitExceededHeaders: vi.fn((s: number) => ({ 'Retry-After': String(s), 'Cache-Control': 'no-store' })),
}));

vi.mock('@/lib/server/security/rate-limit', () => rateLimitMocks);

// ── Other mocks ────────────────────────────────────────────────────────────
const query = vi.fn();
const verify = vi.fn();
const insertAuditLog = vi.fn();
const TEST_PASSWORD_INPUT = 'test-password-input';

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({ query }),
}));

vi.mock('argon2', () => ({
  default: { verify },
}));

vi.mock('@/lib/server/audit/audit-log', () => ({ insertAuditLog }));

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    query.mockReset();
    verify.mockReset();
    insertAuditLog.mockReset();
    rateLimitMocks.checkRateLimit.mockReset();
    rateLimitMocks.resetRateLimitBucket.mockReset();
    // Default: all requests are allowed
    rateLimitMocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 19, resetAt: new Date() });
    rateLimitMocks.resetRateLimitBucket.mockResolvedValue(undefined);
    vi.resetModules();
  });

  it('allows login even when auth audit fails and exposes x-propsys-audit=failed', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ id: 'u1', client_id: 'client_001', password_hash: 'hash', status: 'ACTIVE' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    verify.mockResolvedValue(true);
    insertAuditLog.mockRejectedValue(new Error('audit down'));

    const { POST } = await import('./login/route');

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
      body: JSON.stringify({ email: 'manager@propsys.com', password: TEST_PASSWORD_INPUT }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-propsys-audit')).toBe('failed');
    expect(res.cookies.get('ps_session')?.value).toMatch(/^sess_/);
  });

  it('blocks login for users that are not ACTIVE', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'u12', client_id: 'client_001', password_hash: 'hash', status: 'SUSPENDED' }],
    });

    const { POST } = await import('./login/route');

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'inactive@propsys.com', password: TEST_PASSWORD_INPUT }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Usuario inactivo');
    expect(verify).not.toHaveBeenCalled();
    expect(insertAuditLog).not.toHaveBeenCalled();
  });

  it('rejects ACTIVE users without password hash as invalid credentials', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'u_pending', client_id: 'client_001', password_hash: null, status: 'ACTIVE' }],
    });

    const { POST } = await import('./login/route');

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'pending@propsys.com', password: TEST_PASSWORD_INPUT }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Credenciales inválidas');
    expect(verify).not.toHaveBeenCalled();
    expect(insertAuditLog).not.toHaveBeenCalled();
  });

  it('rate limits by IP via durable rate limiter and returns 429 with Retry-After', async () => {
    // Simulate IP bucket already exhausted
    rateLimitMocks.checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
      retryAfter: 60,
    });

    const { POST } = await import('./login/route');

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ email: 'manager@propsys.com', password: 'wrong' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Demasiados intentos de inicio de sesión. Intenta nuevamente mas tarde.');
    // DB should NOT be queried when rate-limited
    expect(query).not.toHaveBeenCalled();
  });

  it('rate limits repeated failed login attempts by identity via durable rate limiter', async () => {
    // First call (IP check) passes, second call (identity check) is blocked
    rateLimitMocks.checkRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 19, resetAt: new Date() })
      .mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + 300_000),
        retryAfter: 300,
      });

    const { POST } = await import('./login/route');

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'manager@propsys.com', password: 'wrong' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('Demasiados intentos de inicio de sesión. Intenta nuevamente mas tarde.');
  });
});
