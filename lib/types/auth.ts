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

export type UserInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

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

export interface UserInvitation {
  id: string;
  clientId?: string | null;
  userId: string;
  invitedByUserId?: string | null;
  email: string;
  tokenHash: string;
  status: UserInvitationStatus;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordResetToken {
  id: string;
  clientId?: string | null;
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export type { UIRole };

