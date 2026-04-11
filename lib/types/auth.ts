import { UserRole as UIRole } from './index';

export type InternalRole = 
  | 'ROOT_ADMIN' 
  | 'CLIENT_MANAGER' 
  | 'BUILDING_ADMIN' 
  | 'STAFF' 
  | 'OWNER' 
  | 'OCCUPANT';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type AuthScope = 'platform' | 'client';

export interface UserV2 {
  id: string;
  email: string;
  name: string;
  internalRole: InternalRole;
  clientId?: string | null;
  scope: AuthScope;
  status: UserStatus;
  avatarUrl?: string;
  buildingId?: string;
  unitId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type { UIRole };

