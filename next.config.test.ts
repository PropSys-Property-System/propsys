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

    expect(headers.get('Content-Security-Policy-Report-Only')).toContain("default-src 'self'");
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(headers.get('Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );
  });

  it('adds CSP report-only with frame and object restrictions', async () => {
    const headers = await loadGlobalHeaders();
    const csp = headers.get('Content-Security-Policy-Report-Only');

    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("connect-src 'self'");
  });

  it('only enables HSTS in production', async () => {
    expect((await loadGlobalHeaders()).has('Strict-Transport-Security')).toBe(false);

    vi.stubEnv('NODE_ENV', 'production');

    expect((await loadGlobalHeaders()).get('Strict-Transport-Security')).toBe(
      'max-age=15552000'
    );
  });
});
