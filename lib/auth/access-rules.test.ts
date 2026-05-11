import { describe, expect, it } from 'vitest';
import {
  canAccessAdminApp,
  canAccessPortfolioAdminApp,
  canBypassTenantScope,
  canManageUserLifecycle,
  canAccessResidentApp,
  canAccessResidentUnitsApp,
  canAccessStaffApp,
  getDefaultRouteForUser,
} from '@/lib/auth/access-rules';

describe('access-rules', () => {
  it('only ROOT_ADMIN with platform scope can bypass tenant scope', () => {
    expect(canBypassTenantScope({ internalRole: 'ROOT_ADMIN', scope: 'platform', clientId: null })).toBe(true);
    expect(canBypassTenantScope({ internalRole: 'CLIENT_MANAGER', scope: 'platform', clientId: 'client_001' })).toBe(false);
    expect(canBypassTenantScope({ internalRole: 'ROOT_ADMIN', scope: 'client', clientId: 'client_001' })).toBe(false);
  });

  it('derives the correct default route from internalRole', () => {
    expect(getDefaultRouteForUser({ internalRole: 'ROOT_ADMIN' })).toBe('/admin/dashboard');
    expect(getDefaultRouteForUser({ internalRole: 'BUILDING_ADMIN' })).toBe('/admin/dashboard');
    expect(getDefaultRouteForUser({ internalRole: 'STAFF' })).toBe('/staff/tasks');
    expect(getDefaultRouteForUser({ internalRole: 'OWNER' })).toBe('/resident/receipts');
    expect(getDefaultRouteForUser({ internalRole: 'OCCUPANT' })).toBe('/resident/receipts');
  });

  it('keeps section access aligned with internalRole', () => {
    expect(canAccessAdminApp({ internalRole: 'ROOT_ADMIN' })).toBe(true);
    expect(canAccessPortfolioAdminApp({ internalRole: 'CLIENT_MANAGER' })).toBe(true);
    expect(canAccessPortfolioAdminApp({ internalRole: 'BUILDING_ADMIN' })).toBe(false);
    expect(canAccessStaffApp({ internalRole: 'STAFF' })).toBe(true);
    expect(canAccessResidentApp({ internalRole: 'OCCUPANT' })).toBe(true);
    expect(canAccessResidentUnitsApp({ internalRole: 'OWNER' })).toBe(true);
    expect(canAccessResidentUnitsApp({ internalRole: 'OCCUPANT' })).toBe(false);
  });

  it('keeps user lifecycle permissions conservative', () => {
    expect(
      canManageUserLifecycle(
        { id: 'u_root', internalRole: 'ROOT_ADMIN', scope: 'platform', clientId: null },
        { id: 'u_staff', internalRole: 'STAFF', scope: 'client', clientId: 'client_002' }
      )
    ).toBe(true);

    expect(
      canManageUserLifecycle(
        { id: 'u_mgr', internalRole: 'CLIENT_MANAGER', scope: 'client', clientId: 'client_001' },
        { id: 'u_staff', internalRole: 'STAFF', scope: 'client', clientId: 'client_001' }
      )
    ).toBe(true);

    expect(
      canManageUserLifecycle(
        { id: 'u_mgr', internalRole: 'CLIENT_MANAGER', scope: 'client', clientId: 'client_001' },
        { id: 'u_mgr_2', internalRole: 'CLIENT_MANAGER', scope: 'client', clientId: 'client_001' }
      )
    ).toBe(false);

    expect(
      canManageUserLifecycle(
        { id: 'u_mgr', internalRole: 'CLIENT_MANAGER', scope: 'client', clientId: 'client_001' },
        { id: 'u_root', internalRole: 'ROOT_ADMIN', scope: 'platform', clientId: null }
      )
    ).toBe(false);

    expect(
      canManageUserLifecycle(
        { id: 'u_self', internalRole: 'ROOT_ADMIN', scope: 'platform', clientId: null },
        { id: 'u_self', internalRole: 'ROOT_ADMIN', scope: 'platform', clientId: null }
      )
    ).toBe(false);

    expect(
      canManageUserLifecycle(
        { id: 'u_root', internalRole: 'ROOT_ADMIN', scope: 'platform', clientId: null },
        { id: 'u_platform', internalRole: 'ROOT_ADMIN', scope: 'platform', clientId: null }
      )
    ).toBe(false);
  });
});
