import { InternalRole, AuthScope, UserStatus } from './auth';
export * from './physical';
export * from './operation';
export * from './communication';

export type UserRole =
  | 'MANAGER'
  | 'BUILDING_ADMIN'
  | 'STAFF'
  | 'OWNER'
  | 'TENANT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole; // Derived UI Role for compatibility
  internalRole: InternalRole; // Source of Truth
  clientId?: string | null;
  scope: AuthScope;
  status: UserStatus;
  avatarUrl?: string;
  buildingId?: string;
  unitId?: string;
}

export type ReceiptStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Receipt {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: ReceiptStatus;
  description: string;
  unitId: string;
  buildingId: string;
  pdfUrl?: string;
}

export interface Building {
  id: string;
  clientId?: string;
  name: string;
  address: string;
  city: string;
}

export interface Unit {
  id: string;
  clientId?: string;
  buildingId: string;
  number: string;
  floor?: string;
  ownerId?: string;
  residentId?: string;
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Ticket {
  id: string;
  buildingId: string;
  unitId?: string;
  createdByUserId: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
}

export type NoticeAudience = 'BUILDING' | 'ALL_BUILDINGS';

export interface Notice {
  id: string;
  buildingId?: string;
  audience: NoticeAudience;
  title: string;
  body: string;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  buildingId: string;
  name: string;
  role: string;
  phone?: string;
  shift?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CommonArea {
  id: string;
  clientId?: string;
  buildingId: string;
  name: string;
  capacity?: number;
  requiresApproval: boolean;
}

export type ReservationStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Reservation {
  id: string;
  buildingId: string;
  unitId: string;
  commonAreaId: string;
  createdByUserId: string;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
