import { randomUUID } from 'node:crypto';
import type { Queryable } from '@/lib/server/db/tx';

function jsonOrNull(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  return JSON.stringify(value);
}

export async function insertAuditLog(
  db: Queryable,
  input: {
    clientId: string;
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    metadata?: unknown;
    oldData?: unknown;
    newData?: unknown;
  }
): Promise<void> {
  const id = `audit_${Date.now()}_${randomUUID().slice(0, 8)}`;
  await db.query(
    `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, old_data, new_data)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)`,
    [
      id,
      input.clientId,
      input.userId,
      input.action,
      input.entity,
      input.entityId,
      jsonOrNull(input.metadata),
      jsonOrNull(input.oldData),
      jsonOrNull(input.newData),
    ]
  );
}

