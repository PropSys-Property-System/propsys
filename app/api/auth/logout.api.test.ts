import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const insertAuditLog = vi.fn();

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query,
  }),
}));

vi.mock('@/lib/server/audit/audit-log', () => ({
  insertAuditLog,
}));

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    query.mockReset();
    insertAuditLog.mockReset();
    vi.resetModules();
  });

  it('allows logout even when auth audit fails and exposes x-propsys-audit=failed', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            user_id: 'u1',
            client_id: 'client_001',
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    insertAuditLog.mockRejectedValue(new Error('audit down'));

    const { POST } = await import('./logout/route');

    const req = new Request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: {
        cookie: 'ps_session=sess_test_123',
        'user-agent': 'vitest',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-propsys-audit')).toBe('failed');
    expect(res.cookies.get('ps_session')?.value).toBe('');
  });

  it('returns ok when there is no session cookie', async () => {
    const { POST } = await import('./logout/route');

    const req = new Request('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(query).not.toHaveBeenCalled();
    expect(insertAuditLog).not.toHaveBeenCalled();
  });
});
