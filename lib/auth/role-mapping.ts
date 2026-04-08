import { InternalRole, UIRole } from '../types/auth';

/**
 * Mapeo dinámico de roles internos (negocio) a roles de interfaz (UI).
 * Esto permite que el frontend actual siga funcionando sin cambios, 
 * mientras el backend estructural maneja una jerarquía más granular.
 */
export function mapInternalRoleToUIRole(internalRole: InternalRole): UIRole {
  switch (internalRole) {
    case 'ROOT_ADMIN':
    case 'CLIENT_MANAGER':
      return 'MANAGER';
    case 'BUILDING_ADMIN':
      return 'BUILDING_ADMIN';
    case 'STAFF':
      return 'STAFF';
    case 'OWNER':
      return 'OWNER';
    case 'OCCUPANT':
      return 'TENANT';
    default: {
      const _exhaustiveCheck: never = internalRole;
      throw new Error(`Unhandled internalRole: ${_exhaustiveCheck}. No mapping defined for UI.`);
    }
  }
}

/**
 * Determina si el usuario tiene acceso a nivel plataforma (Superadmin).
 */
export function isPlatformScope(internalRole: InternalRole): boolean {
  return internalRole === 'ROOT_ADMIN';
}
