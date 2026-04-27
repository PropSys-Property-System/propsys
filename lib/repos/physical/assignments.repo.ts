import { User, UserBuildingAssignment, UserUnitAssignment } from '@/lib/types';
import { MOCK_PHYSICAL_UNITS, MOCK_USERS, MOCK_USER_BUILDING_ASSIGNMENTS, MOCK_USER_UNIT_ASSIGNMENTS } from '@/lib/mocks';
import { canAccessClientRecord, canBypassTenantScope } from '@/lib/auth/access-rules';
import { isDbMode } from '@/lib/config/data-mode';
import { getBuildingAssignments, getUnitAssignments } from '@/lib/access/assignments-cache';
import { fetchJsonOrThrow } from '@/lib/repos/http';
import { mapInternalRoleToUIRole } from '@/lib/auth/role-mapping';

function isActiveAssignment(a: { status: string; deletedAt?: string | null }) {
  return a.status === 'ACTIVE' && !a.deletedAt;
}

export type AssignUnitUserInput = {
  unitId: string;
  assignmentType: 'OWNER' | 'OCCUPANT';
  name?: string;
  email?: string;
  password?: string;
  ownerAsResident?: boolean;
};

export type AssignUnitUserResult = {
  user: User;
  unitId: string;
  assignmentType: 'OWNER' | 'OCCUPANT';
  tempPassword?: string;
  ownerAsResident?: boolean;
};

export type UnassignUnitResidentInput = {
  unitId: string;
};

export type UnassignUnitResidentResult = {
  unitId: string;
  assignmentType: 'OCCUPANT';
  userId: string;
};

export const assignmentsRepo = {
  listUnitAssignmentsForUser(user: User): UserUnitAssignment[] {
    if (isDbMode()) {
      const cached = getUnitAssignments(user.id);
      if (!cached) return [];
      return cached
        .filter((a) => isActiveAssignment({ status: a.status, deletedAt: a.deleted_at }) && canAccessClientRecord(user, a.client_id))
        .map((a) => ({
          id: a.id,
          clientId: a.client_id,
          userId: a.user_id,
          unitId: a.unit_id,
          assignmentType: a.assignment_type as UserUnitAssignment['assignmentType'],
          status: a.status as UserUnitAssignment['status'],
          createdAt: a.created_at,
          updatedAt: a.updated_at,
          deletedAt: a.deleted_at,
        }));
    }
    if (canBypassTenantScope(user)) {
      return MOCK_USER_UNIT_ASSIGNMENTS.filter((a) => isActiveAssignment(a) && a.userId === user.id);
    }
    if (!user.clientId) return [];
    return MOCK_USER_UNIT_ASSIGNMENTS.filter((a) => isActiveAssignment(a) && a.clientId === user.clientId && a.userId === user.id);
  },

  listBuildingAssignmentsForUser(user: User): UserBuildingAssignment[] {
    if (isDbMode()) {
      const cached = getBuildingAssignments(user.id);
      if (!cached) return [];
      return cached
        .filter((a) => isActiveAssignment({ status: a.status, deletedAt: a.deleted_at }) && canAccessClientRecord(user, a.client_id))
        .map((a) => ({
          id: a.id,
          clientId: a.client_id,
          userId: a.user_id,
          buildingId: a.building_id,
          status: a.status as UserBuildingAssignment['status'],
          createdAt: a.created_at,
          updatedAt: a.updated_at,
          deletedAt: a.deleted_at,
        }));
    }
    if (canBypassTenantScope(user)) {
      return MOCK_USER_BUILDING_ASSIGNMENTS.filter((a) => isActiveAssignment(a) && a.userId === user.id);
    }
    if (!user.clientId) return [];
    return MOCK_USER_BUILDING_ASSIGNMENTS.filter((a) => isActiveAssignment(a) && a.clientId === user.clientId && a.userId === user.id);
  },

  listUnitIdsForOwner(user: User): string[] {
    return this.listUnitAssignmentsForUser(user)
      .filter((a) => a.assignmentType === 'OWNER')
      .map((a) => a.unitId);
  },

  isOwnerOfUnit(user: User, unitId: string): boolean {
    return this.listUnitAssignmentsForUser(user).some((a) => a.assignmentType === 'OWNER' && a.unitId === unitId);
  },

  isAssignedToBuilding(user: User, buildingId: string): boolean {
    return this.listBuildingAssignmentsForUser(user).some((a) => a.buildingId === buildingId);
  },

  async assignUserToUnit(user: User, input: AssignUnitUserInput): Promise<AssignUnitUserResult> {
    if (isDbMode()) {
      return fetchJsonOrThrow<AssignUnitUserResult>('/api/v1/physical/unit-assignments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    }

    if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
      throw new Error('No autorizado');
    }

    const unit = MOCK_PHYSICAL_UNITS.find((item) => item.id === input.unitId && item.status === 'ACTIVE');
    if (!unit || !canAccessClientRecord(user, unit.clientId)) throw new Error('Unidad no encontrada');

    const slotTaken = MOCK_USER_UNIT_ASSIGNMENTS.some(
      (assignment) =>
        isActiveAssignment(assignment) &&
        assignment.unitId === input.unitId &&
        assignment.assignmentType === input.assignmentType
    );
    if (slotTaken) {
      throw new Error(input.assignmentType === 'OWNER' ? 'La unidad ya tiene propietario asignado.' : 'La unidad ya tiene inquilino asignado.');
    }

    const now = new Date().toISOString();
    if (input.ownerAsResident) {
      if (input.assignmentType !== 'OCCUPANT') throw new Error('Datos invalidos');
      const ownerAssignment = MOCK_USER_UNIT_ASSIGNMENTS.find(
        (assignment) =>
          isActiveAssignment(assignment) &&
          assignment.unitId === input.unitId &&
          assignment.assignmentType === 'OWNER'
      );
      const owner = ownerAssignment ? MOCK_USERS.find((item) => item.id === ownerAssignment.userId) : null;
      if (!owner || owner.status !== 'ACTIVE' || owner.internalRole !== 'OWNER' || owner.clientId !== unit.clientId) {
        throw new Error('Primero asigna un propietario activo a la unidad.');
      }

      MOCK_USER_UNIT_ASSIGNMENTS.unshift({
        id: `uua_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        clientId: unit.clientId,
        userId: owner.id,
        unitId: unit.id,
        assignmentType: 'OCCUPANT',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      });

      return {
        user: { ...owner, unitId: unit.id },
        unitId: unit.id,
        assignmentType: 'OCCUPANT',
        ownerAsResident: true,
      };
    }

    const email = input.email?.trim().toLowerCase() ?? '';
    const name = input.name?.trim() ?? '';
    if (!name || !email) throw new Error('Completa nombre y email para asignar el usuario.');

    const internalRole = input.assignmentType === 'OWNER' ? 'OWNER' : 'OCCUPANT';
    let target = MOCK_USERS.find((item) => item.email.toLowerCase() === email);
    let tempPassword: string | undefined;

    if (target) {
      if (target.clientId !== unit.clientId || target.internalRole !== internalRole) {
        throw new Error('Ese email ya existe con otro rol o cliente.');
      }
      if (target.status !== 'ACTIVE') {
        throw new Error('Ese usuario existe pero no esta activo; reactivarlo antes de asignarlo.');
      }
    } else {
      tempPassword = input.password?.trim() || `Ps${Math.random().toString(36).slice(2, 10)}!`;
      target = {
        id: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        email,
        name,
        role: mapInternalRoleToUIRole(internalRole),
        internalRole,
        clientId: unit.clientId,
        scope: 'client',
        status: 'ACTIVE',
        unitId: unit.id,
      };
      MOCK_USERS.push(target);
    }

    MOCK_USER_UNIT_ASSIGNMENTS.unshift({
      id: `uua_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      clientId: unit.clientId,
      userId: target.id,
      unitId: unit.id,
      assignmentType: input.assignmentType,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    return {
      user: { ...target, unitId: unit.id },
      unitId: unit.id,
      assignmentType: input.assignmentType,
      tempPassword,
    };
  },

  async unassignUnitResident(user: User, input: UnassignUnitResidentInput): Promise<UnassignUnitResidentResult> {
    if (isDbMode()) {
      return fetchJsonOrThrow<UnassignUnitResidentResult>('/api/v1/physical/unit-assignments', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    }

    if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
      throw new Error('No autorizado');
    }

    const unit = MOCK_PHYSICAL_UNITS.find((item) => item.id === input.unitId && item.status === 'ACTIVE');
    if (!unit || !canAccessClientRecord(user, unit.clientId)) throw new Error('Unidad no encontrada');

    const assignment = MOCK_USER_UNIT_ASSIGNMENTS.find(
      (item) => isActiveAssignment(item) && item.unitId === input.unitId && item.assignmentType === 'OCCUPANT'
    );
    if (!assignment) throw new Error('La unidad no tiene residencia activa.');

    const now = new Date().toISOString();
    assignment.status = 'ARCHIVED';
    assignment.deletedAt = now;
    assignment.updatedAt = now;

    return {
      unitId: unit.id,
      assignmentType: 'OCCUPANT',
      userId: assignment.userId,
    };
  },
};
