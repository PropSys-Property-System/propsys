import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCanonicalAppUrl } from './app-url';

describe('canonical app URL helper', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds links from PROPSYS_APP_URL and ignores path/query in the configured base', () => {
    vi.stubEnv('PROPSYS_APP_URL', 'https://app.propsys.test/admin?from=config');

    const url = buildCanonicalAppUrl('/reset-password', { token: 'abc_123' });

    expect(url).toBe('https://app.propsys.test/reset-password?token=abc_123');
  });

  it('falls back to NEXT_PUBLIC_APP_URL when the server-side URL is not set', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://public.propsys.test');

    const url = buildCanonicalAppUrl('/invitations/accept', { token: 'invite_token' });

    expect(url).toBe('https://public.propsys.test/invitations/accept?token=invite_token');
  });

  it('requires https in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PROPSYS_APP_URL', 'http://app.propsys.test');

    expect(() => buildCanonicalAppUrl('/reset-password')).toThrow('PROPSYS_APP_URL debe usar https en produccion.');
  });

  it('rejects relative paths without a leading slash', () => {
    vi.stubEnv('PROPSYS_APP_URL', 'https://app.propsys.test');

    expect(() => buildCanonicalAppUrl('reset-password')).toThrow('La ruta canonica debe empezar con /.');
  });
});
