import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── DB mock ────────────────────────────────────────────────────────────────
const query = vi.fn();

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({ query }),
}));

// ── Import after mocks ─────────────────────────────────────────────────────
import {
  checkRateLimit,
  getClientIp,
  hashRateLimitKey,
  rateLimitExceededHeaders,
  resetRateLimitBucket,
} from './rate-limit';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeBucketRow(count: number, resetAt: Date) {
  return { rows: [{ count, reset_at: resetAt.toISOString() }] };
}

describe('hashRateLimitKey', () => {
  it('returns a namespaced sha256 hex string', () => {
    const key = hashRateLimitKey('login:ip', '203.0.113.1');
    expect(key).toMatch(/^login:ip:[0-9a-f]{64}$/);
  });

  it('normalises email to lowercase before hashing', () => {
    const a = hashRateLimitKey('email', 'User@Example.COM');
    const b = hashRateLimitKey('email', 'user@example.com');
    expect(a).toBe(b);
  });

  it('produces different keys for different namespaces', () => {
    const a = hashRateLimitKey('ns1', 'value');
    const b = hashRateLimitKey('ns2', 'value');
    expect(a).not.toBe(b);
  });

  it('does not store the raw email in the key', () => {
    const email = 'secret@example.com';
    const key = hashRateLimitKey('login:identity', email);
    expect(key).not.toContain(email);
  });
});

describe('getClientIp', () => {
  it('extracts ip from x-forwarded-for (first value)', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '198.51.100.1' },
    });
    expect(getClientIp(req)).toBe('198.51.100.1');
  });

  it('returns unknown when no ip header present', () => {
    const req = new Request('http://localhost');
    expect(getClientIp(req)).toBe('unknown');
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('allows request when count is within limit', async () => {
    const resetAt = new Date(Date.now() + 60_000);
    query.mockResolvedValueOnce(makeBucketRow(1, resetAt));

    const result = await checkRateLimit('test:key', 5, 60_000);

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.remaining).toBe(4);
      expect(result.resetAt).toEqual(resetAt);
    }
  });

  it('blocks request when count exceeds limit', async () => {
    const resetAt = new Date(Date.now() + 30_000);
    query.mockResolvedValueOnce(makeBucketRow(6, resetAt));

    const result = await checkRateLimit('test:key', 5, 60_000);

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(30);
    }
  });

  it('returns remaining = 0 exactly at the limit (count === limit)', async () => {
    const resetAt = new Date(Date.now() + 10_000);
    query.mockResolvedValueOnce(makeBucketRow(5, resetAt));

    const result = await checkRateLimit('test:key', 5, 60_000);

    expect(result.allowed).toBe(true);
    if (result.allowed) {
      expect(result.remaining).toBe(0);
    }
  });

  it('passes the key and window to the upsert query', async () => {
    const resetAt = new Date(Date.now() + 60_000);
    query.mockResolvedValueOnce(makeBucketRow(1, resetAt));

    await checkRateLimit('mykey', 10, 60_000);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('rate_limit_buckets');
    expect(params[0]).toBe('mykey');
  });

  it('throws when the upsert returns no row', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(checkRateLimit('key', 5, 60_000)).rejects.toThrow('rate_limit_buckets upsert returned no row');
  });
});

describe('resetRateLimitBucket', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('deletes the bucket row by key', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await resetRateLimitBucket('some:key');

    expect(query).toHaveBeenCalledWith(
      'DELETE FROM rate_limit_buckets WHERE key = $1',
      ['some:key']
    );
  });
});

describe('rateLimitExceededHeaders', () => {
  it('returns Retry-After and Cache-Control', () => {
    const headers = rateLimitExceededHeaders(60);
    expect(headers['Retry-After']).toBe('60');
    expect(headers['Cache-Control']).toBe('no-store');
  });
});
