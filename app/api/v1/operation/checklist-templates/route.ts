import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import type { ChecklistTemplate } from '@/lib/types';

async function listBuildingIdsForUser(
  pool: ReturnType<typeof getPool>,
  user: { id: string; clientId: string | null; scope: string; internalRole: string }
) {
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

function toTemplate(row: {
  id: string;
  client_id: string;
  building_id: string;
  name: string;
  description: string | null;
  items: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): ChecklistTemplate {
  return {
    id: row.id,
    clientId: row.client_id,
    buildingId: row.building_id,
    name: row.name,
    items: Array.isArray(row.items) ? (row.items as ChecklistTemplate['items']) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') return NextResponse.json({ templates: [] as ChecklistTemplate[] });
  if (user.scope !== 'platform' && !user.clientId) return NextResponse.json({ templates: [] as ChecklistTemplate[] });

  const pool = getPool();
  const tenantWhere = user.scope === 'platform' ? '' : 'AND client_id = $1';
  const tenantParams = user.scope === 'platform' ? [] : [user.clientId];

  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ templates: [] as ChecklistTemplate[] });

  const rows = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    name: string;
    description: string | null;
    items: unknown;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, building_id, name, description, items, created_at, updated_at, deleted_at
     FROM checklist_templates
     WHERE deleted_at IS NULL
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
     ORDER BY created_at DESC`,
    [...tenantParams, buildingIds]
  );

  return NextResponse.json({ templates: rows.rows.map(toTemplate) });
}


