import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope, hasTenantClientContext } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { IncidentEntity } from '@/lib/types';

async function listBuildingIdsForUser(pool: ReturnType<typeof getPool>, user: { id: string; clientId: string | null; scope: string; internalRole: string }) {
  if (canBypassTenantScope(user)) {
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
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    const rows = await pool.query<{ building_id: string }>(
      `SELECT DISTINCT u.building_id
       FROM user_unit_assignments uua
       JOIN units u ON u.id = uua.unit_id
       WHERE uua.user_id = $1
         AND uua.status = 'ACTIVE'
         AND uua.deleted_at IS NULL
         AND uua.assignment_type = $2
         AND u.client_id = $3`,
      [user.id, user.internalRole === 'OWNER' ? 'OWNER' : 'OCCUPANT', user.clientId]
    );
    return rows.rows.map((r) => r.building_id);
  }
  return [];
}

async function listUnitIdsForUser(pool: ReturnType<typeof getPool>, user: { id: string; clientId: string | null; scope: string; internalRole: string }) {
  if (!user.clientId) return [];
  if (user.internalRole !== 'OWNER' && user.internalRole !== 'OCCUPANT') return [];
  const rows = await pool.query<{ unit_id: string }>(
    `SELECT unit_id
     FROM user_unit_assignments
     WHERE user_id = $1
       AND status = 'ACTIVE'
       AND deleted_at IS NULL
       AND assignment_type = $2
       AND client_id = $3`,
    [user.id, user.internalRole === 'OWNER' ? 'OWNER' : 'OCCUPANT', user.clientId]
  );
  return rows.rows.map((r) => r.unit_id);
}

function toEntity(row: {
  id: string;
  client_id: string;
  building_id: string;
  unit_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  reported_by_user_id: string;
  assigned_to_user_id: string | null;
  created_at: string;
  updated_at: string;
}): IncidentEntity {
  return {
    id: row.id,
    clientId: row.client_id,
    buildingId: row.building_id,
    unitId: row.unit_id ?? undefined,
    title: row.title,
    description: row.description,
    status: row.status as IncidentEntity['status'],
    priority: row.priority as IncidentEntity['priority'],
    reportedByUserId: row.reported_by_user_id,
    assignedToUserId: row.assigned_to_user_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const bypassTenant = canBypassTenantScope(user);
  if (!hasTenantClientContext(user)) return NextResponse.json({ incidents: [] });

  const pool = getPool();
  const tenantWhere = bypassTenant ? '' : 'AND client_id = $1';
  const tenantParams = bypassTenant ? [] : [user.clientId];

  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    const unitIds = await listUnitIdsForUser(pool, user);
    const buildingIds = await listBuildingIdsForUser(pool, user);
    if (unitIds.length === 0 && buildingIds.length === 0) return NextResponse.json({ incidents: [] });
    const rows = await pool.query<{
      id: string;
      client_id: string;
      building_id: string;
      unit_id: string | null;
      title: string;
      description: string;
      status: string;
      priority: string;
      reported_by_user_id: string;
      assigned_to_user_id: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, client_id, building_id, unit_id, title, description, status, priority, reported_by_user_id, assigned_to_user_id, created_at, updated_at
       FROM incidents
       WHERE 1=1
         ${tenantWhere}
         AND (
           unit_id = ANY($${tenantParams.length + 1}::text[])
           OR (unit_id IS NULL AND building_id = ANY($${tenantParams.length + 2}::text[]))
         )
       ORDER BY created_at DESC`,
      [...tenantParams, unitIds, buildingIds]
    );
    return NextResponse.json({ incidents: rows.rows.map(toEntity) });
  }

  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ incidents: [] });

  const staffExtraWhere =
    user.internalRole === 'STAFF'
      ? `AND (assigned_to_user_id = $${tenantParams.length + 2} OR reported_by_user_id = $${tenantParams.length + 2})`
      : '';

  const rows = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    unit_id: string | null;
    title: string;
    description: string;
    status: string;
    priority: string;
    reported_by_user_id: string;
    assigned_to_user_id: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, client_id, building_id, unit_id, title, description, status, priority, reported_by_user_id, assigned_to_user_id, created_at, updated_at
     FROM incidents
     WHERE 1=1
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
       ${staffExtraWhere}
     ORDER BY created_at DESC`,
    user.internalRole === 'STAFF' ? [...tenantParams, buildingIds, user.id] : [...tenantParams, buildingIds]
  );
  return NextResponse.json({ incidents: rows.rows.map(toEntity) });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OCCUPANT') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const bypassTenant = canBypassTenantScope(user);
  if (!hasTenantClientContext(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const buildingId = typeof body?.buildingId === 'string' ? body.buildingId : null;
  const unitId = typeof body?.unitId === 'string' ? body.unitId : null;
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const priority = body?.priority === 'LOW' || body?.priority === 'MEDIUM' || body?.priority === 'HIGH' ? body.priority : null;

  if (!buildingId || !title || !description || !priority) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const pool = getPool();

  const buildingRes = await pool.query<{ client_id: string }>('SELECT client_id FROM buildings WHERE id = $1 LIMIT 1', [buildingId]);
  const building = buildingRes.rows[0];
  if (!building) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const clientId = bypassTenant ? building.client_id : user.clientId;
  if (!clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (!bypassTenant && building.client_id !== clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  if (unitId) {
    const unitRes = await pool.query<{ id: string }>(
      `SELECT id
       FROM units
       WHERE id = $1 AND client_id = $2 AND building_id = $3
       LIMIT 1`,
      [unitId, clientId, buildingId]
    );
    if (!unitRes.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (user.internalRole === 'OWNER') {
    if (!unitId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM user_unit_assignments
       WHERE user_id = $1 AND unit_id = $2 AND client_id = $3 AND assignment_type = 'OWNER' AND status = 'ACTIVE' AND deleted_at IS NULL
       LIMIT 1`,
      [user.id, unitId, clientId]
    );
    if (!ok.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  } else if (user.internalRole === 'STAFF' || user.internalRole === 'BUILDING_ADMIN') {
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM user_building_assignments
       WHERE user_id = $1 AND building_id = $2 AND client_id = $3 AND status = 'ACTIVE' AND deleted_at IS NULL
       LIMIT 1`,
      [user.id, buildingId, clientId]
    );
    if (!ok.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const status: IncidentEntity['status'] = 'REPORTED';
  const assignedToUserId = user.internalRole === 'STAFF' ? user.id : null;
  const id = `inc_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    const row = await withTransaction(pool, async (db) => {
      const created = await db.query<{
        id: string;
        client_id: string;
        building_id: string;
        unit_id: string | null;
        title: string;
        description: string;
        status: string;
        priority: string;
        reported_by_user_id: string;
        assigned_to_user_id: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `INSERT INTO incidents (id, client_id, building_id, unit_id, title, description, status, priority, reported_by_user_id, assigned_to_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
         RETURNING id, client_id, building_id, unit_id, title, description, status, priority, reported_by_user_id, assigned_to_user_id, created_at, updated_at`,
        [id, clientId, buildingId, unitId, title, description, status, priority, user.id, assignedToUserId, now]
      );
      await insertAuditLog(db, {
        clientId,
        userId: user.id,
        action: 'CREATE',
        entity: 'Incident',
        entityId: id,
        metadata: { buildingId, unitId, status, priority },
        newData: created.rows[0],
      });
      return created;
    });
    return NextResponse.json({ incident: toEntity(row.rows[0]) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
