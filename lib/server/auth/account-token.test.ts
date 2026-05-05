import { describe, expect, it } from 'vitest';
import {
  addAccountTokenExpiry,
  generateAccountToken,
  hashAccountToken,
  isAccountTokenExpired,
  verifyAccountToken,
} from './account-token';

describe('account-token', () => {
  it('genera un token crudo suficientemente largo', () => {
    const token = generateAccountToken();

    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashea el token sin persistir el valor crudo', () => {
    const token = generateAccountToken();
    const hash = hashAccountToken(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
  });

  it('valida el mismo token contra su hash', () => {
    const token = generateAccountToken();
    const hash = hashAccountToken(token);

    expect(verifyAccountToken(token, hash)).toBe(true);
  });

  it('rechaza tokens alterados', () => {
    const token = generateAccountToken();
    const hash = hashAccountToken(token);

    expect(verifyAccountToken(`${token}x`, hash)).toBe(false);
  });

  it('rechaza hashes invalidos sin fallar', () => {
    const token = generateAccountToken();

    expect(verifyAccountToken(token, 'not-a-valid-hash')).toBe(false);
    expect(verifyAccountToken(token, '')).toBe(false);
  });

  it('calcula y evalua expiracion de tokens', () => {
    const now = new Date('2026-05-04T10:00:00.000Z');
    const expiresAt = addAccountTokenExpiry(now, 60_000);

    expect(expiresAt.toISOString()).toBe('2026-05-04T10:01:00.000Z');
    expect(isAccountTokenExpired(expiresAt, now)).toBe(false);
    expect(isAccountTokenExpired(expiresAt, new Date('2026-05-04T10:01:00.001Z'))).toBe(true);
  });
});
