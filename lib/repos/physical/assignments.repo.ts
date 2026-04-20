import { User, UserBuildingAssignment, UserUnitAssignment } from '@/lib/types';
import { MOCK_USER_BUILDING_ASSIGNMENTS, MOCK_USER_UNIT_ASSIGNMENTS } from '@/lib/mocks';
import { canAccessClientRecord, canBypassTenantScope } from '@/lib/auth/access-rules';
import { isDbMode } from '@/lib/config/data-mode';
import { getBuildingAssignments, getUnitAssignments } from '@/lib/access/assignments-cache';

function isActiveAssignment(a: { status: string; deletedAt?: string | null }) {
  return a.status === 'ACTIVE' && !a.deletedAt;
}

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
};
