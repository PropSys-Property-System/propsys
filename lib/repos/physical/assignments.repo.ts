import { User, UserBuildingAssignment, UserUnitAssignment } from '@/lib/types';
import { MOCK_USER_BUILDING_ASSIGNMENTS, MOCK_USER_UNIT_ASSIGNMENTS } from '@/lib/mocks';

function isActiveAssignment(a: { status: string; deletedAt?: string | null }) {
  return a.status === 'ACTIVE' && !a.deletedAt;
}

export const assignmentsRepo = {
  listUnitAssignmentsForUser(user: User): UserUnitAssignment[] {
    if (user.scope === 'platform') {
      return MOCK_USER_UNIT_ASSIGNMENTS.filter((a) => isActiveAssignment(a) && a.userId === user.id);
    }
    if (!user.clientId) return [];
    return MOCK_USER_UNIT_ASSIGNMENTS.filter((a) => isActiveAssignment(a) && a.clientId === user.clientId && a.userId === user.id);
  },

  listBuildingAssignmentsForUser(user: User): UserBuildingAssignment[] {
    if (user.scope === 'platform') {
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
