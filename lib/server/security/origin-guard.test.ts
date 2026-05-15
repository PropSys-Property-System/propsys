import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateApiMutationOrigin } from './origin-guard';

function request(input: {
  url?: string;
  method?: string;
  origin?: string;
  referer?: string;
  fetchSite?: string;
  cookie?: string;
}) {
  const headers = new Headers();
  if (input.origin) headers.set('origin', input.origin);
  if (input.referer) headers.set('referer', input.referer);
  if (input.fetchSite) headers.set('sec-fetch-site', input.fetchSite);
  if (input.cookie) headers.set('cookie', input.cookie);

  return new Request(input.url ?? 'https://app.propsys.test/api/v1/users', {
    method: input.method ?? 'POST',
    headers,
  });
}

describe('origin guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.PROPSYS_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('allows same-origin POST requests', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(validateApiMutationOrigin(request({ origin: 'https://app.propsys.test' }))).toEqual({ ok: true });
  });

  it('allows same-origin PATCH requests', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(validateApiMutationOrigin(request({ method: 'PATCH', origin: 'https://app.propsys.test' }))).toEqual({ ok: true });
  });

  it('allows same-origin DELETE requests', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(validateApiMutationOrigin(request({ method: 'DELETE', origin: 'https://app.propsys.test' }))).toEqual({ ok: true });
  });

  it('rejects cross-origin POST requests', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(validateApiMutationOrigin(request({ origin: 'https://evil.example' }))).toEqual({
      ok: false,
      status: 403,
      error: 'Origen no permitido',
    });
  });

  it('rejects Sec-Fetch-Site cross-site requests', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(validateApiMutationOrigin(request({ origin: 'https://app.propsys.test', fetchSite: 'cross-site' }))).toEqual({
      ok: false,
      status: 403,
      error: 'Origen no permitido',
    });
  });

  it('does not block GET requests', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(validateApiMutationOrigin(request({ method: 'GET', origin: 'https://evil.example', fetchSite: 'cross-site' }))).toEqual({ ok: true });
  });

  it('allows localhost origins in development and test', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(validateApiMutationOrigin(request({ url: 'https://app.propsys.test/api/v1/users', origin: 'http://localhost:3000' }))).toEqual({ ok: true });

    vi.stubEnv('NODE_ENV', 'test');

    expect(validateApiMutationOrigin(request({ url: 'https://app.propsys.test/api/v1/users', origin: 'http://127.0.0.1:3000' }))).toEqual({ ok: true });
  });

  it('allows configured app origins', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PROPSYS_APP_URL', 'https://admin.propsys.test');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.propsys.test');

    expect(validateApiMutationOrigin(request({ url: 'https://render.propsys.test/api/v1/users', origin: 'https://admin.propsys.test' }))).toEqual({ ok: true });
    expect(validateApiMutationOrigin(request({ url: 'https://render.propsys.test/api/v1/users', origin: 'https://app.propsys.test' }))).toEqual({ ok: true });
  });

  it('evaluates Referer when production session-cookie requests omit Origin', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(
      validateApiMutationOrigin(
        request({
          cookie: 'ps_session=sess_00000000-0000-4000-8000-000000000000',
          referer: 'https://app.propsys.test/admin/users',
        })
      )
    ).toEqual({ ok: true });

    expect(
      validateApiMutationOrigin(
        request({
          cookie: 'ps_session=sess_00000000-0000-4000-8000-000000000000',
          referer: 'https://evil.example/attack',
        })
      )
    ).toEqual({ ok: false, status: 403, error: 'Origen no permitido' });
  });
});