import { createHash } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: Date }
  | { allowed: false; remaining: 0; resetAt: Date; retryAfter: number };

/**
 * Derives a safe, opaque bucket key by SHA-256 hashing the raw identifier.
 * Use this for sensitive values (email addresses, tokens) so the DB never
 * stores plaintext PII in the rate_limit_buckets table.
 */
export function hashRateLimitKey(namespace: string, value: string): string {
  const digest = createHash('sha256')
    .update(`${namespace}:${value.trim().toLowerCase()}`)
    .digest('hex');
  return `${namespace}:${digest}`;
}

/**
 * Returns the best-effort client IP from standard proxy headers.
 * Falls back to "unknown" so callers always get a usable string.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('cf-connecting-ip')?.trim() ||
    'unknown'
  );
}

/**
 * Atomically checks and increments a rate-limit counter in Postgres.
 *
 * Uses INSERT … ON CONFLICT DO UPDATE so the whole operation is a single
 * round-trip with no TOCTOU race.
 *
 * @param key       Opaque bucket key (use hashRateLimitKey for PII).
 * @param limit     Maximum allowed hits within the window.
 * @param windowMs  Duration of the sliding window in milliseconds.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const pool = getPool();
  const nowMs = Date.now();
  const resetAt = new Date(nowMs + windowMs);
  const resetIso = resetAt.toISOString();
  const nowIso = new Date(nowMs).toISOString();

  /*
   * Atomic upsert:
   * • If the row does not exist → insert with count = 1.
   * • If the row exists but reset_at has passed → reset count to 1.
   * • If the row exists and is within the window → increment.
   *
   * RETURNING always gives us the post-update count and reset_at so we
   * can compute remaining in one query.
   */
  const result = await pool.query<{ count: number; reset_at: string }>(
    `INSERT INTO rate_limit_buckets (key, count, reset_at, updated_at)
     VALUES ($1, 1, $2, $3)
     ON CONFLICT (key) DO UPDATE
       SET count      = CASE
                          WHEN rate_limit_buckets.reset_at <= $3
                          THEN 1
                          ELSE rate_limit_buckets.count + 1
                        END,
           reset_at   = CASE
                          WHEN rate_limit_buckets.reset_at <= $3
                          THEN $2
                          ELSE rate_limit_buckets.reset_at
                        END,
           updated_at = $3
     RETURNING count, reset_at::text as reset_at`,
    [key, resetIso, nowIso]
  );

  const row = result.rows[0];
  if (!row) {
    // Should never happen, but fail-open is dangerous for rate limiting — fail closed.
    throw new Error('rate_limit_buckets upsert returned no row');
  }

  const bucketResetAt = new Date(row.reset_at);
  const remaining = Math.max(0, limit - row.count);

  if (row.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucketResetAt.getTime() - nowMs) / 1000));
    return { allowed: false, remaining: 0, resetAt: bucketResetAt, retryAfter };
  }

  return { allowed: true, remaining, resetAt: bucketResetAt };
}

/**
 * Resets a specific rate-limit bucket (e.g. on successful login).
 * Silently no-ops if the bucket does not exist.
 */
export async function resetRateLimitBucket(key: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM rate_limit_buckets WHERE key = $1', [key]);
}

/**
 * Builds a 429 NextResponse with the standard Retry-After header.
 * Import from next/server in the route file that calls this.
 */
export function rateLimitExceededHeaders(retryAfter: number): Record<string, string> {
  return {
    'Retry-After': String(retryAfter),
    'Cache-Control': 'no-store',
  };
}
