import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEnv } from './env';

describe('validateEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('desarrollo/test no falla por ausencia de variables de producción', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DATABASE_URL;
    expect(() => validateEnv()).not.toThrow();
  });

  it('producción falla con PROPSYS_EXPOSE_AUTH_TOKENS=1', () => {
    process.env.NODE_ENV = 'production';
    process.env.PROPSYS_EXPOSE_AUTH_TOKENS = '1';
    expect(() => validateEnv()).toThrow('PROPSYS_EXPOSE_AUTH_TOKENS no puede ser "1"');
  });

  it('producción falla con ALLOW_MOCK_MODE=1', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_MOCK_MODE = '1';
    expect(() => validateEnv()).toThrow('ALLOW_MOCK_MODE no puede ser "1"');
  });

  it('producción falla si falta DATABASE_URL', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    expect(() => validateEnv()).toThrow('DATABASE_URL debe existir');
  });

  it('producción falla si falta Storage requerido', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SUPABASE_STORAGE_EVIDENCE_BUCKET;
    expect(() => validateEnv()).toThrow('SUPABASE_STORAGE_EVIDENCE_BUCKET debe existir');
  });
});
