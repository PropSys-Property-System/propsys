import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from './next.config';

async function loadGlobalHeaders() {
  const rules = await nextConfig.headers?.();
  const globalRule = rules?.find((rule) => rule.source === '/:path*');
  return new Map(globalRule?.headers.map((header) => [header.key, header.value]) ?? []);
}

describe('next security headers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('applies the baseline security headers globally', async () => {
    const headers = await loadGlobalHeaders();

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(headers.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );
  });

  it('only enables HSTS in production', async () => {
    expect((await loadGlobalHeaders()).has('Strict-Transport-Security')).toBe(false);

    vi.stubEnv('NODE_ENV', 'production');

    expect((await loadGlobalHeaders()).get('Strict-Transport-Security')).toBe(
      'max-age=15552000'
    );
  });
});
