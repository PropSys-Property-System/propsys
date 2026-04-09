export type ClientStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

export interface Client {
  id: string;
  name: string;
  taxId: string;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DEACTIVATE' 
  | 'RESTORE' 
  | 'APPROVE' 
  | 'REJECT' 
  | 'ARCHIVE';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  clientId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  payload: {
    oldData?: unknown;
    newData?: unknown;
    metadata?: Record<string, unknown>;
  };
}
