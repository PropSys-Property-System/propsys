import type { AuthScope, InternalRole } from '@/lib/types/auth';

type RoleScopedUser = {
  internalRole: InternalRole | string;
  scope: AuthScope | string;
  clientId?: string | null;
};

type ClientScopedEntity = {
  clientId?: string | null;
};

type UserLifecycleTarget = {
  id: string;
  internalRole: InternalRole | string;
  scope: AuthScope | string;
  clientId?: string | null;
};

export const ADMIN_INTERNAL_ROLES = ['ROOT_ADMIN', 'CLIENT_MANAGER', 'BUILDING_ADMIN'] as const;
export const PORTFOLIO_ADMIN_INTERNAL_ROLES = ['ROOT_ADMIN', 'CLIENT_MANAGER'] as const;
export const STAFF_INTERNAL_ROLES = ['STAFF'] as const;
export const RESIDENT_INTERNAL_ROLES = ['OWNER', 'OCCUPANT'] as const;
export const OWNER_INTERNAL_ROLES = ['OWNER'] as const;

export function hasInternalRole(user: Pick<RoleScopedUser, 'internalRole'>, roles: readonly InternalRole[]): boolean {
  return roles.includes(user.internalRole as InternalRole);
}

export function canBypassTenantScope(user: RoleScopedUser): boolean {
  return user.scope === 'platform' && user.internalRole === 'ROOT_ADMIN';
}

export function canAccessClientRecord(user: RoleScopedUser, clientId: string | null | undefined): boolean {
  if (canBypassTenantScope(user)) return true;
  return Boolean(user.clientId) && user.clientId === clientId;
}

export function filterItemsByTenant<T extends ClientScopedEntity>(items: T[], user: RoleScopedUser): T[] {
  if (canBypassTenantScope(user)) return items;
  if (!user.clientId) return [];
  return items.filter((item) => item.clientId === user.clientId);
}

export function requireClientContext(user: RoleScopedUser, message = 'Selecciona un cliente para continuar.'): string {
  if (!user.clientId) {
    throw new Error(message);
  }
  return user.clientId;
}

export function canManageUserLifecycle(
  actor: RoleScopedUser & { id?: string | null },
  target: UserLifecycleTarget
): boolean {
  if (actor.id && actor.id === target.id) return false;
  if (target.scope === 'platform') return false;

  if (canBypassTenantScope(actor)) return true;

  if (actor.internalRole !== 'CLIENT_MANAGER') return false;
  if (!actor.clientId || actor.clientId !== target.clientId) return false;
  if (target.internalRole === 'ROOT_ADMIN' || target.internalRole === 'CLIENT_MANAGER') return false;

  return true;
}

export function canAccessAdminApp(user: Pick<RoleScopedUser, 'internalRole'>): boolean {
  return hasInternalRole(user, ADMIN_INTERNAL_ROLES);
}

export function canAccessPortfolioAdminApp(user: Pick<RoleScopedUser, 'internalRole'>): boolean {
  return hasInternalRole(user, PORTFOLIO_ADMIN_INTERNAL_ROLES);
}

export function canAccessStaffApp(user: Pick<RoleScopedUser, 'internalRole'>): boolean {
  return hasInternalRole(user, STAFF_INTERNAL_ROLES);
}

export function canAccessResidentApp(user: Pick<RoleScopedUser, 'internalRole'>): boolean {
  return hasInternalRole(user, RESIDENT_INTERNAL_ROLES);
}

export function canAccessResidentUnitsApp(user: Pick<RoleScopedUser, 'internalRole'>): boolean {
  return hasInternalRole(user, OWNER_INTERNAL_ROLES);
}

export function getDefaultRouteForUser(user: Pick<RoleScopedUser, 'internalRole'>): string {
  if (canAccessAdminApp(user)) return '/admin/dashboard';
  if (canAccessStaffApp(user)) return '/staff/tasks';
  if (canAccessResidentApp(user)) return '/resident/receipts';
  return '/';
}
