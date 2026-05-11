import { canBypassTenantScope as canBypassTenantScopeRule } from '@/lib/auth/access-rules';
import type { AuthScope, InternalRole } from '@/lib/types/auth';

type TenantScopedUser = {
  internalRole: InternalRole | string;
  scope: AuthScope | string;
  clientId?: string | null;
};

export const canBypassTenantScope = canBypassTenantScopeRule;

export function hasTenantClientContext(user: TenantScopedUser): boolean {
  return canBypassTenantScopeRule(user) || Boolean(user.clientId);
}

export function canAccessTenantEntity(user: TenantScopedUser, clientId: string | null | undefined): boolean {
  if (canBypassTenantScopeRule(user)) return true;
  return Boolean(user.clientId) && user.clientId === clientId;
}
