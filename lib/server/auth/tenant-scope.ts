import type { AuthScope, InternalRole } from '@/lib/types/auth';

export function canBypassTenantScope(user: { scope: AuthScope | string; internalRole: InternalRole | string }): boolean {
  return user.scope === 'platform' && user.internalRole === 'ROOT_ADMIN';
}

