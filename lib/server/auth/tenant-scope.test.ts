import { describe, expect, it } from 'vitest';
import { canAccessTenantEntity, canBypassTenantScope, hasTenantClientContext } from '@/lib/server/auth/tenant-scope';

describe('server tenant scope helpers', () => {
  it('allows bypass only for ROOT_ADMIN in platform scope', () => {
    expect(canBypassTenantScope({ internalRole: 'ROOT_ADMIN', scope: 'platform', clientId: null })).toBe(true);
    expect(canBypassTenantScope({ internalRole: 'CLIENT_MANAGER', scope: 'platform', clientId: 'client_001' })).toBe(false);
  });

  it('detects tenant client context consistently', () => {
    expect(hasTenantClientContext({ internalRole: 'CLIENT_MANAGER', scope: 'client', clientId: 'client_001' })).toBe(true);
    expect(hasTenantClientContext({ internalRole: 'CLIENT_MANAGER', scope: 'platform', clientId: 'client_001' })).toBe(true);
    expect(hasTenantClientContext({ internalRole: 'STAFF', scope: 'client', clientId: null })).toBe(false);
  });

  it('checks access to tenant entities by client id', () => {
    expect(canAccessTenantEntity({ internalRole: 'ROOT_ADMIN', scope: 'platform', clientId: null }, 'client_002')).toBe(true);
    expect(canAccessTenantEntity({ internalRole: 'CLIENT_MANAGER', scope: 'client', clientId: 'client_001' }, 'client_001')).toBe(true);
    expect(canAccessTenantEntity({ internalRole: 'CLIENT_MANAGER', scope: 'client', clientId: 'client_001' }, 'client_002')).toBe(false);
    expect(canAccessTenantEntity({ internalRole: 'STAFF', scope: 'client', clientId: null }, 'client_001')).toBe(false);
  });
});
