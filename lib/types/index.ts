export type UserRole = 'ADMIN' | 'STAFF' | 'RESIDENT' | 'OWNER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
  name: string;
  address: string;
  city: string;
}

export interface Unit {
  id: string;
  buildingId: string;
  number: string;
  floor?: string;
  ownerId?: string;
  residentId?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
