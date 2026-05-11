const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_FAILURES_BY_IDENTITY = 5;
const LOGIN_RATE_LIMIT_MAX_FAILURES_BY_IP = 20;

type LoginRateLimitBucket = {
  failures: number;
  resetAt: number;
};

const buckets = new Map<string, LoginRateLimitBucket>();

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    forwardedFor ||
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('cf-connecting-ip')?.trim() ||
    'unknown'
  );
}

function getIpBucketKey(req: Request): string {
  return `ip:${getClientIp(req)}`;
}

function getIdentityBucketKey(req: Request, email: string): string {
  return `identity:${getClientIp(req)}:${email}`;
}

function checkBucket(key: string, maxFailures: number, now: number) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.delete(key);
    return { limited: false, retryAfterSeconds: 0 };
  }
  if (bucket.failures < maxFailures) {
    return { limited: false, retryAfterSeconds: 0 };
  }
  return {
    limited: true,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

function recordFailure(key: string, now: number) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { failures: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS });
    return;
  }
  bucket.failures += 1;
}

export function checkLoginRateLimit(req: Request, email: string, now = Date.now()) {
  const ipLimit = checkBucket(getIpBucketKey(req), LOGIN_RATE_LIMIT_MAX_FAILURES_BY_IP, now);
  if (ipLimit.limited) return ipLimit;
  return checkBucket(getIdentityBucketKey(req, email), LOGIN_RATE_LIMIT_MAX_FAILURES_BY_IDENTITY, now);
}

export function recordFailedLoginAttempt(req: Request, email: string, now = Date.now()) {
  recordFailure(getIpBucketKey(req), now);
  recordFailure(getIdentityBucketKey(req, email), now);
}

export function clearFailedLoginAttempts(req: Request, email: string) {
  buckets.delete(getIdentityBucketKey(req, email));
}
