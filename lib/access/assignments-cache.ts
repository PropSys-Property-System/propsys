export type CachedBuildingAssignment = {
  id: string;
  client_id: string;
  user_id: string;
  building_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CachedUnitAssignment = {
  id: string;
  client_id: string;
  user_id: string;
  unit_id: string;
  assignment_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const buildingAssignmentsByUserId = new Map<string, CachedBuildingAssignment[]>();
const unitAssignmentsByUserId = new Map<string, CachedUnitAssignment[]>();

export function setAssignmentsCache(
  userId: string,
  input: { buildingAssignments: CachedBuildingAssignment[]; unitAssignments: CachedUnitAssignment[] }
) {
  buildingAssignmentsByUserId.set(userId, input.buildingAssignments);
  unitAssignmentsByUserId.set(userId, input.unitAssignments);
}

export function clearAssignmentsCache(userId: string) {
  buildingAssignmentsByUserId.delete(userId);
  unitAssignmentsByUserId.delete(userId);
}

export function getBuildingAssignments(userId: string) {
  return buildingAssignmentsByUserId.get(userId) ?? null;
}

export function getUnitAssignments(userId: string) {
  return unitAssignmentsByUserId.get(userId) ?? null;
}


