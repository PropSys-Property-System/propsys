import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOKEN_BYTES = 32;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

export function generateAccountToken(byteLength = DEFAULT_TOKEN_BYTES): string {
  if (!Number.isInteger(byteLength) || byteLength < DEFAULT_TOKEN_BYTES) {
    throw new Error(`Account tokens must use at least ${DEFAULT_TOKEN_BYTES} random bytes`);
  }

  return randomBytes(byteLength).toString('base64url');
}

export function hashAccountToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function verifyAccountToken(token: string, expectedHash: string): boolean {
  if (!token || !SHA256_HEX_PATTERN.test(expectedHash)) {
    return false;
  }

  const candidate = Buffer.from(hashAccountToken(token), 'hex');
  const expected = Buffer.from(expectedHash.toLowerCase(), 'hex');

  if (candidate.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(candidate, expected);
}

export function addAccountTokenExpiry(now: Date, ttlMs: number): Date {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('Account token ttlMs must be positive');
  }

  return new Date(now.getTime() + ttlMs);
}

export function isAccountTokenExpired(expiresAt: Date | string, now = new Date()): boolean {
  const expiresAtDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const expiresAtMs = expiresAtDate.getTime();

  if (Number.isNaN(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= now.getTime();
}
