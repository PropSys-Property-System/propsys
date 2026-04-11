import { pgTable, text, timestamp, boolean, integer, numeric, date, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export const clients = pgTable('clients', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id'),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    internalRole: text('internal_role').notNull(),
    scope: text('scope').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_unique').on(t.email),
  })
);

export const buildings = pgTable('buildings', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const units = pgTable('units', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  buildingId: text('building_id').notNull(),
  number: text('number').notNull(),
  floor: text('floor'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const commonAreas = pgTable('common_areas', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  buildingId: text('building_id').notNull(),
  name: text('name').notNull(),
  capacity: integer('capacity').notNull().default(1),
  requiresApproval: boolean('requires_approval').notNull().default(true),
  status: text('status').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userBuildingAssignments = pgTable(
  'user_building_assignments',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull(),
    userId: text('user_id').notNull(),
    buildingId: text('building_id').notNull(),
    status: text('status').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('uba_user_building_unique_active').on(t.userId, t.buildingId),
  })
);

export const userUnitAssignments = pgTable(
  'user_unit_assignments',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id').notNull(),
    userId: text('user_id').notNull(),
    unitId: text('unit_id').notNull(),
    assignmentType: text('assignment_type').notNull(),
    status: text('status').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('uua_user_unit_type_unique_active').on(t.userId, t.unitId, t.assignmentType),
  })
);

export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  buildingId: text('building_id').notNull(),
  unitId: text('unit_id'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  reportedByUserId: text('reported_by_user_id').notNull(),
  assignedToUserId: text('assigned_to_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  buildingId: text('building_id').notNull(),
  assignedToUserId: text('assigned_to_user_id').notNull(),
  createdByUserId: text('created_by_user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const checklistTemplates = pgTable('checklist_templates', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  buildingId: text('building_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  items: jsonb('items').notNull().default([]),
  status: text('status').notNull(),
  createdByUserId: text('created_by_user_id').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const checklistExecutions = pgTable('checklist_executions', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  buildingId: text('building_id').notNull(),
  unitId: text('unit_id'),
  taskId: text('task_id'),
  templateId: text('template_id').notNull(),
  assignedToUserId: text('assigned_to_user_id').notNull(),
  status: text('status').notNull(),
  results: jsonb('results').notNull().default([]),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const evidenceAttachments = pgTable('evidence_attachments', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  buildingId: text('building_id').notNull(),
  unitId: text('unit_id'),
  incidentId: text('incident_id'),
  taskId: text('task_id'),
  checklistExecutionId: text('checklist_execution_id'),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  url: text('url').notNull(),
  uploadedByUserId: text('uploaded_by_user_id').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notices = pgTable('notices', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  audience: text('audience').notNull(),
  buildingId: text('building_id'),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull(),
  createdByUserId: text('created_by_user_id').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reservations = pgTable('reservations', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  buildingId: text('building_id').notNull(),
  unitId: text('unit_id').notNull(),
  commonAreaId: text('common_area_id').notNull(),
  createdByUserId: text('created_by_user_id').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  status: text('status').notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const receipts = pgTable('receipts', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  buildingId: text('building_id').notNull(),
  unitId: text('unit_id').notNull(),
  number: text('number').notNull(),
  description: text('description'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  metadata: jsonb('metadata'),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable('auth_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  clientId: text('client_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

