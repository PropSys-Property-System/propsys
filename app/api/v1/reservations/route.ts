import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { Reservation, ReservationEntity } from '@/lib/types';

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
  unit_id: string;
  common_area_id: string;
  created_by_user_id: string;
  start_at: string;
  end_at: string;
  status: string;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  deleted_at: string | null;
}): ReservationEntity {
  return {
    id: row.id,
    clientId: row.client_id,
    buildingId: row.building_id,
    unitId: row.unit_id,
    commonAreaId: row.common_area_id,
    createdByUserId: row.created_by_user_id,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status as ReservationEntity['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at ?? undefined,
    deletedAt: row.deleted_at,
  };
}

function toLegacyReservation(e: ReservationEntity): Reservation {
  return {
    id: e.id,
    buildingId: e.buildingId,
    unitId: e.unitId,
    commonAreaId: e.commonAreaId,
    createdByUserId: e.createdByUserId,
    startAt: e.startAt,
    endAt: e.endAt,
    status: e.status,
  };
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(user);
  const tenantWhere = bypassTenant ? '' : 'AND client_id = $1';
  const tenantParams = bypassTenant ? [] : [user.clientId];

  if (!bypassTenant && !user.clientId) return NextResponse.json({ reservations: [] });

  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    const unitIds = await listUnitIdsForUser(pool, user);
    if (unitIds.length === 0) return NextResponse.json({ reservations: [] });
    const rows = await pool.query<{
      id: string;
      client_id: string;
      building_id: string;
      unit_id: string;
      common_area_id: string;
      created_by_user_id: string;
      start_at: string;
      end_at: string;
      status: string;
      cancelled_at: string | null;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, client_id, building_id, unit_id, common_area_id, created_by_user_id, start_at, end_at, status, cancelled_at, deleted_at, created_at, updated_at
       FROM reservations
       WHERE deleted_at IS NULL
         ${tenantWhere}
         AND unit_id = ANY($${tenantParams.length + 1}::text[])
       ORDER BY start_at DESC`,
      [...tenantParams, unitIds]
    );
    const entities = rows.rows.map(toEntity);
    return NextResponse.json({ reservations: entities.map(toLegacyReservation) });
  }

  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ reservations: [] });
  const rows = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    unit_id: string;
    common_area_id: string;
    created_by_user_id: string;
    start_at: string;
    end_at: string;
    status: string;
    cancelled_at: string | null;
    deleted_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, client_id, building_id, unit_id, common_area_id, created_by_user_id, start_at, end_at, status, cancelled_at, deleted_at, created_at, updated_at
     FROM reservations
     WHERE deleted_at IS NULL
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
     ORDER BY start_at DESC`,
    [...tenantParams, buildingIds]
  );
  const entities = rows.rows.map(toEntity);
  return NextResponse.json({ reservations: entities.map(toLegacyReservation) });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  if (user.internalRole !== 'OWNER' && user.internalRole !== 'OCCUPANT') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const buildingId = typeof body?.buildingId === 'string' ? body.buildingId : null;
  const unitId = typeof body?.unitId === 'string' ? body.unitId : null;
  const commonAreaId = typeof body?.commonAreaId === 'string' ? body.commonAreaId : null;
  const startAt = typeof body?.startAt === 'string' ? body.startAt : null;
  const endAt = typeof body?.endAt === 'string' ? body.endAt : null;

  if (!buildingId || !unitId || !commonAreaId || !startAt || !endAt) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
  if (start >= end) return NextResponse.json({ error: 'La hora de inicio debe ser anterior al término.' }, { status: 400 });

  const pool = getPool();

  const unitRes = await pool.query<{ client_id: string; building_id: string }>(
    'SELECT client_id, building_id FROM units WHERE id = $1 LIMIT 1',
    [unitId]
  );
  const unitRow = unitRes.rows[0];
  if (!unitRow) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (unitRow.building_id !== buildingId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const clientId = bypassTenant ? unitRow.client_id : user.clientId;
  if (!clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (!bypassTenant && unitRow.client_id !== clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const assignmentOk = await pool.query<{ ok: boolean }>(
    `SELECT true as ok
     FROM user_unit_assignments uua
     JOIN units u ON u.id = uua.unit_id
     WHERE uua.user_id = $1
       AND uua.unit_id = $2
       AND uua.assignment_type = $3
       AND uua.status = 'ACTIVE'
       AND uua.deleted_at IS NULL
       AND uua.client_id = $4
       AND u.client_id = uua.client_id
     LIMIT 1`,
    [user.id, unitId, user.internalRole === 'OWNER' ? 'OWNER' : 'OCCUPANT', clientId]
  );
  if (!assignmentOk.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const areaRes = await pool.query<{ requires_approval: boolean; client_id: string; building_id: string; status: string; deleted_at: string | null }>(
    `SELECT requires_approval, client_id, building_id, status, deleted_at
     FROM common_areas
     WHERE id = $1
     LIMIT 1`,
    [commonAreaId]
  );
  const area = areaRes.rows[0];
  if (!area) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (area.client_id !== clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (area.building_id !== buildingId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (area.status !== 'ACTIVE' || area.deleted_at) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const overlap = await pool.query<{ id: string }>(
    `SELECT id
     FROM reservations
     WHERE client_id = $1
       AND building_id = $2
       AND common_area_id = $3
       AND deleted_at IS NULL
       AND status NOT IN ('CANCELLED', 'REJECTED')
       AND start_at < $4
       AND end_at > $5
     LIMIT 1`,
    [clientId, buildingId, commonAreaId, end.toISOString(), start.toISOString()]
  );
  if (overlap.rows[0]) return NextResponse.json({ error: 'Ese horario ya está reservado.' }, { status: 409 });

  const now = new Date().toISOString();
  const status: ReservationEntity['status'] = area.requires_approval ? 'REQUESTED' : 'APPROVED';
  const id = `resv_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    const rowRes = await withTransaction(pool, async (db) => {
      const created = await db.query<{
        id: string;
        client_id: string;
        building_id: string;
        unit_id: string;
        common_area_id: string;
        created_by_user_id: string;
        start_at: string;
        end_at: string;
        status: string;
        cancelled_at: string | null;
        deleted_at: string | null;
        created_at: string;
        updated_at: string;
      }>(
        `INSERT INTO reservations (id, client_id, building_id, unit_id, common_area_id, created_by_user_id, start_at, end_at, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
         RETURNING id, client_id, building_id, unit_id, common_area_id, created_by_user_id, start_at, end_at, status, cancelled_at, deleted_at, created_at, updated_at`,
        [id, clientId, buildingId, unitId, commonAreaId, user.id, start.toISOString(), end.toISOString(), status, now]
      );
      await insertAuditLog(db, {
        clientId,
        userId: user.id,
        action: 'CREATE',
        entity: 'Reservation',
        entityId: id,
        metadata: { buildingId, unitId, commonAreaId, status },
        newData: created.rows[0],
      });
      return created;
    });

    return NextResponse.json({ reservation: toEntity(rowRes.rows[0]) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
