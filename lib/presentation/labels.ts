import { IncidentEntity, NoticeAudience, ReservationStatus, User, UserRole } from '@/lib/types';

export function labelUserRole(role: UserRole): string {
  switch (role) {
    case 'MANAGER':
      return 'Gerente';
    case 'BUILDING_ADMIN':
      return 'Administrador';
    case 'STAFF':
      return 'Personal';
    case 'OWNER':
      return 'Propietario';
    case 'TENANT':
      return 'Inquilino';
    default: {
      const _exhaustiveCheck: never = role;
      return _exhaustiveCheck;
    }
  }
}

export function labelInternalRole(role: User['internalRole']): string {
  switch (role) {
    case 'ROOT_ADMIN':
      return 'Superadministrador';
    case 'CLIENT_MANAGER':
      return 'Gerente';
    case 'BUILDING_ADMIN':
      return 'Administrador';
    case 'STAFF':
      return 'Personal';
    case 'OWNER':
      return 'Propietario';
    case 'OCCUPANT':
      return 'Inquilino';
    default: {
      const _exhaustiveCheck: never = role;
      return _exhaustiveCheck;
    }
  }
}

export function labelUserStatus(status: User['status']): string {
  switch (status) {
    case 'ACTIVE':
      return 'Activo';
    case 'SUSPENDED':
      return 'Suspendido';
    case 'INACTIVE':
      return 'Inactivo';
    case 'ARCHIVED':
      return 'Archivado';
    default: {
      const _exhaustiveCheck: never = status;
      return _exhaustiveCheck;
    }
  }
}

export function labelIncidentStatus(status: IncidentEntity['status']): string {
  switch (status) {
    case 'REPORTED':
      return 'Reportada';
    case 'ASSIGNED':
      return 'Asignada';
    case 'IN_PROGRESS':
      return 'En progreso';
    case 'RESOLVED':
      return 'Resuelta';
    case 'CLOSED':
      return 'Cerrada';
    default: {
      const _exhaustiveCheck: never = status;
      return _exhaustiveCheck;
    }
  }
}

export function labelIncidentPriority(priority: IncidentEntity['priority']): string {
  switch (priority) {
    case 'LOW':
      return 'Baja';
    case 'MEDIUM':
      return 'Media';
    case 'HIGH':
      return 'Alta';
    default: {
      const _exhaustiveCheck: never = priority;
      return _exhaustiveCheck;
    }
  }
}

export function labelClient(clientId: string): string {
  const nameById: Record<string, string> = {
    client_001: 'PropSys Administraciones Globales',
    client_002: 'Gestión Residencial Sur',
  };
  return nameById[clientId] ?? 'Cliente';
}

export function labelNoticeAudience(audience: NoticeAudience): string {
  switch (audience) {
    case 'BUILDING':
      return 'Edificio';
    case 'ALL_BUILDINGS':
      return 'Todos los edificios';
    default: {
      const _exhaustiveCheck: never = audience;
      return _exhaustiveCheck;
    }
  }
}

export function labelReservationStatus(status: ReservationStatus): string {
  switch (status) {
    case 'REQUESTED':
      return 'Solicitada';
    case 'APPROVED':
      return 'Aprobada';
    case 'REJECTED':
      return 'Rechazada';
    case 'CANCELLED':
      return 'Cancelada';
    default: {
      const _exhaustiveCheck: never = status;
      return _exhaustiveCheck;
    }
  }
}

export function formatClientBadge(user: User | null): string | null {
  if (!user) return null;
  if (user.scope === 'platform') return labelInternalRole(user.internalRole);
  if (!user.clientId) return null;
  return `Cliente: ${labelClient(user.clientId)}`;
}

export function labelWorkspaceArea(user: User): string {
  switch (user.internalRole) {
    case 'ROOT_ADMIN':
      return 'Plataforma';
    case 'CLIENT_MANAGER':
      return 'Administración';
    case 'BUILDING_ADMIN':
      return 'Edificio';
    case 'STAFF':
      return 'Operaciones';
    case 'OWNER':
    case 'OCCUPANT':
      return 'Portal residente';
    default: {
      const _exhaustiveCheck: never = user.internalRole;
      return _exhaustiveCheck;
    }
  }
}

export function labelAccessScope(user: User): string | null {
  if (user.scope === 'platform') return 'Acceso global';
  if (!user.clientId) return null;
  const safeClientNameById: Record<string, string> = {
    client_001: 'PropSys Administraciones Globales',
    client_002: 'Gestión Residencial Sur',
  };
  return safeClientNameById[user.clientId] ?? labelClient(user.clientId);
}
