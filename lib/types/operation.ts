export type IncidentStatus = 'REPORTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type IncidentPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface IncidentEntity {
  id: string;
  clientId: string;
  buildingId: string;
  unitId?: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  reportedByUserId: string;
  assignedToUserId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED';

export interface TaskEntity {
  id: string;
  clientId: string;
  buildingId: string;
  checklistTemplateId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedToUserId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistTemplateItem {
  id: string;
  label: string;
  required: boolean;
}

export interface ChecklistTemplate {
  id: string;
  clientId: string;
  buildingId: string;
  isPrivate?: boolean;
  taskId?: string;
  name: string;
  items: ChecklistTemplateItem[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export type ChecklistExecutionStatus = 'PENDING' | 'COMPLETED' | 'APPROVED';

export interface ChecklistExecutionItemResult {
  itemId: string;
  value: boolean;
  note?: string;
}

export interface ChecklistExecution {
  id: string;
  clientId: string;
  buildingId: string;
  unitId?: string;
  taskId?: string;
  templateId: string;
  assignedToUserId: string;
  status: ChecklistExecutionStatus;
  results: ChecklistExecutionItemResult[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  approvedAt?: string;
  deletedAt?: string | null;
}

export interface EvidenceAttachment {
  id: string;
  clientId: string;
  buildingId: string;
  unitId?: string;
  incidentId?: string;
  taskId?: string;
  checklistExecutionId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  storagePath?: string;
  publicPath?: string;
  url: string;
  uploadedByUserId: string;
  createdAt: string;
  deletedAt?: string | null;
}

