import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const verify = vi.fn();
const insertAuditLog = vi.fn();
const TEST_PASSWORD_INPUT = 'test-password-input';

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query,
  }),
}));

vi.mock('argon2', () => ({
  default: {
    verify,
  },
}));

vi.mock('@/lib/server/audit/audit-log', () => ({
  insertAuditLog,
}));

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    query.mockReset();
    verify.mockReset();
    insertAuditLog.mockReset();
    vi.resetModules();
  });

  it('allows login even when auth audit fails and exposes x-propsys-audit=failed', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'u1',
            client_id: 'client_001',
            password_hash: 'hash',
            status: 'ACTIVE',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    verify.mockResolvedValue(true);
    insertAuditLog.mockRejectedValue(new Error('audit down'));

    const { POST } = await import('./login/route');

    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'vitest',
      },
      body: JSON.stringify({ email: 'manager@propsys.com', password: TEST_PASSWORD_INPUT }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-propsys-audit')).toBe('failed');
    expect(res.cookies.get('ps_session')?.value).toMatch(/^sess_/);
  });

  it('blocks login for users that are not ACTIVE', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'u12',
          client_id: 'client_001',
          password_hash: 'hash',
          status: 'SUSPENDED',
        },
      ],
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

  it('rate limits repeated failed login attempts by client and email', async () => {
    query.mockResolvedValue({ rows: [] });

    const { POST } = await import('./login/route');

    const makeRequest = () =>
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.10',
        },
        body: JSON.stringify({ email: 'manager@propsys.com', password: 'wrong-password' }),
      });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await POST(makeRequest());
      expect(res.status).toBe(401);
    }

    const limited = await POST(makeRequest());
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    const data = (await limited.json()) as { error?: string };
    expect(data.error).toBe('Demasiados intentos de inicio de sesion. Intenta nuevamente mas tarde.');
    expect(query.mock.calls.length).toBe(5);
  });
});
