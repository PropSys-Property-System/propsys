import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDataMode } from './data-mode';

function withClientWindow() {
  const hadWindow = 'window' in globalThis;
  const previousWindow = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {},
    writable: true,
  });
  return () => {
    if (hadWindow) {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
        writable: true,
      });
      return;
    }
    delete (globalThis as { window?: unknown }).window;
  };
}

describe('data mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.DATABASE_URL;
    delete process.env.NEXT_PUBLIC_DATA_MODE;
    delete process.env.DATA_MODE;
    delete process.env.NEXT_PUBLIC_ALLOW_MOCK_MODE;
    delete process.env.ALLOW_MOCK_MODE;
  });

  it('uses db in client runtime when NEXT_PUBLIC_DATA_MODE=db and DATABASE_URL is absent', () => {
    const restoreWindow = withClientWindow();
    try {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('NEXT_PUBLIC_DATA_MODE', 'db');
      delete process.env.DATABASE_URL;

      expect(getDataMode()).toBe('db');
    } finally {
      restoreWindow();
    }
  });

  it('does not fall back to mock in production when DATABASE_URL is absent in client runtime', () => {
    const restoreWindow = withClientWindow();
    try {
      vi.stubEnv('NODE_ENV', 'production');
      delete process.env.NEXT_PUBLIC_DATA_MODE;
      delete process.env.DATA_MODE;
      delete process.env.DATABASE_URL;

      expect(getDataMode()).toBe('db');
    } finally {
      restoreWindow();
    }
  });

  it('keeps server development fallback to mock when no explicit mode and DATABASE_URL is absent', () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.NEXT_PUBLIC_DATA_MODE;
    delete process.env.DATA_MODE;
    delete process.env.DATABASE_URL;

    expect(getDataMode()).toBe('mock');
  });
});
