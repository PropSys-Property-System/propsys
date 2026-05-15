import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function nextRequest(input: { url?: string; method?: string; headers?: Record<string, string> }) {
  return new NextRequest(input.url ?? 'https://app.propsys.test/api/v1/users', {
    method: input.method ?? 'POST',
    headers: input.headers,
  });
}

describe('middleware origin guard', () => {
  it('rejects cross-origin mutating API requests', async () => {
    const res = middleware(
      nextRequest({
        headers: {
          origin: 'https://evil.example',
        },
      })
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Origen no permitido' });
  });

  it('allows same-origin mutating API requests', () => {
    const res = middleware(
      nextRequest({
        headers: {
          origin: 'https://app.propsys.test',
        },
      })
    );

    expect(res.status).not.toBe(403);
  });

  it('keeps private route session protection intact', () => {
    const res = middleware(nextRequest({ url: 'https://app.propsys.test/admin/users', method: 'GET' }));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/?next=%2Fadmin%2Fusers');
  });
});