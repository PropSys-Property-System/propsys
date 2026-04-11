import { InternalRole, UIRole } from '../types/auth';

/**
 * Mapeo dinámico de roles internos (negocio) a roles de interfaz (UI).
 * Esto permite que el frontend actual siga funcionando sin cambios, 
 * mientras el backend estructural maneja una jerarquía más granular.
 */
export function mapInternalRoleToUIRole(internalRole: InternalRole): UIRole {
  const roleMap: Record<InternalRole, UIRole> = {
    'ROOT_ADMIN': 'MANAGER',
    'CLIENT_MANAGER': 'MANAGER',
    'BUILDING_ADMIN': 'BUILDING_ADMIN',
    'STAFF': 'STAFF',
    'OWNER': 'OWNER',
    'OCCUPANT': 'TENANT'
  };

  const uiRole = roleMap[internalRole];
  
  if (!uiRole) {
    throw new Error(`Unhandled internalRole: ${internalRole}. No mapping defined for UI.`);
  }

  return uiRole;
}

/**
 * Determina si el usuario tiene acceso a nivel plataforma (Superadmin).
 */
export function isPlatformScope(internalRole: InternalRole): boolean {
  return internalRole === 'ROOT_ADMIN';
}

