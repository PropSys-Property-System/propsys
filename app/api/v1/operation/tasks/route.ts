import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import type { TaskEntity } from '@/lib/types';

async function listBuildingIdsForUser(pool: ReturnType<typeof getPool>, user: { id: string; clientId: string | null; scope: string; internalRole: string }) {
  if (user.scope === 'platform' && (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER')) {
    const all = await pool.query<{ id: string }>('SELECT id FROM buildings');
    return all.rows.map((r) => r.id);
  }
  if (!user.clientId) return [];
  if (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER') {
    const all = await pool.query<{ id: string }>('SELECT id FROM buildings WHERE client_id = $1', [user.clientId]);
    return all.rows.map((r) => r.id);
  }
  if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
    const rows = await pool.query<{ building_id: string }>(
      `SELECT building_id
       FROM user_building_assignments
       WHERE user_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [user.id]
    );
    return rows.rows.map((r) => r.building_id);
  }
  return [];
}

function toEntity(row: {
  id: string;
  client_id: string;
  building_id: string;
  assigned_to_user_id: string;
  created_by_user_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}): TaskEntity {
  return {
    id: row.id,
    clientId: row.client_id,
    buildingId: row.building_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as TaskEntity['status'],
    assignedToUserId: row.assigned_to_user_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') return NextResponse.json({ tasks: [] });
  if (user.scope !== 'platform' && !user.clientId) return NextResponse.json({ tasks: [] });

  const pool = getPool();
  const tenantWhere = user.scope === 'platform' ? '' : 'AND client_id = $1';
  const tenantParams = user.scope === 'platform' ? [] : [user.clientId];

  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ tasks: [] });

  const staffExtraWhere = user.internalRole === 'STAFF' ? `AND assigned_to_user_id = $${tenantParams.length + 2}` : '';

  const rows = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    assigned_to_user_id: string;
    created_by_user_id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, client_id, building_id, assigned_to_user_id, created_by_user_id, title, description, status, created_at, updated_at
     FROM tasks
     WHERE 1=1
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
       ${staffExtraWhere}
     ORDER BY created_at DESC`,
    user.internalRole === 'STAFF' ? [...tenantParams, buildingIds, user.id] : [...tenantParams, buildingIds]
  );

  return NextResponse.json({ tasks: rows.rows.map(toEntity) });
}

