export type PhysicalEntityStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface BuildingEntity {
  id: string;
  clientId: string;
  name: string;
  address: string;
  city: string;
  status: PhysicalEntityStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface UnitEntity {
  id: string;
  clientId: string;
  buildingId: string;
  number: string;
  floor?: string;
  status: PhysicalEntityStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CommonAreaEntity {
  id: string;
  clientId: string;
  buildingId: string;
  name: string;
  capacity?: number;
  requiresApproval: boolean;
  status: PhysicalEntityStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface UserBuildingAssignment {
  id: string;
  clientId: string;
  userId: string;
  buildingId: string;
  status: PhysicalEntityStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type UserUnitAssignmentType = 'OWNER' | 'OCCUPANT';

export interface UserUnitAssignment {
  id: string;
  clientId: string;
  userId: string;
  unitId: string;
  assignmentType: UserUnitAssignmentType;
  status: PhysicalEntityStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

