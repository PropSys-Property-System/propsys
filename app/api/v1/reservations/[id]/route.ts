import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { ReservationEntity } from '@/lib/types';

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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const action = body?.action === 'APPROVE' || body?.action === 'REJECT' || body?.action === 'CANCEL' ? body.action : null;
  if (!action) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const pool = getPool();
  const currentRes = await pool.query<{
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
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current || current.deleted_at) return NextResponse.json({ reservation: null }, { status: 404 });
  if (!canBypassTenantScope(user) && (!user.clientId || current.client_id !== user.clientId)) {
    return NextResponse.json({ reservation: null }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (action === 'CANCEL') {
    if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
      if (current.created_by_user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      const assignmentOk = await pool.query<{ ok: boolean }>(
        `SELECT true as ok
         FROM user_unit_assignments uua
         WHERE uua.user_id = $1
           AND uua.unit_id = $2
           AND uua.assignment_type = $3
           AND uua.status = 'ACTIVE'
           AND uua.deleted_at IS NULL
           AND uua.client_id = $4
         LIMIT 1`,
        [user.id, current.unit_id, user.internalRole === 'OWNER' ? 'OWNER' : 'OCCUPANT', current.client_id]
      );
      if (!assignmentOk.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    } else if (user.internalRole === 'BUILDING_ADMIN') {
      const ok = await pool.query<{ ok: boolean }>(
        `SELECT true as ok
         FROM user_building_assignments
         WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
         LIMIT 1`,
        [user.id, current.building_id]
      );
      if (!ok.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    } else {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (current.status === 'CANCELLED') return NextResponse.json({ reservation: toEntity(current) });

    try {
      const updated = await withTransaction(pool, async (db) => {
        const res = await db.query<{
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
          `UPDATE reservations
           SET status = 'CANCELLED', cancelled_at = $2, updated_at = $2
           WHERE id = $1
           RETURNING id, client_id, building_id, unit_id, common_area_id, created_by_user_id, start_at, end_at, status, cancelled_at, deleted_at, created_at, updated_at`,
          [id, now]
        );
        await insertAuditLog(db, {
          clientId: current.client_id,
          userId: user.id,
          action: 'UPDATE',
          entity: 'Reservation',
          entityId: id,
          metadata: { action },
          oldData: current,
          newData: res.rows[0],
        });
        return res;
      });
      return NextResponse.json({ reservation: toEntity(updated.rows[0]) });
    } catch {
      return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
    }
  }

  if (user.internalRole !== 'BUILDING_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const buildingOk = await pool.query<{ ok: boolean }>(
    `SELECT true as ok
     FROM user_building_assignments
     WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
     LIMIT 1`,
    [user.id, current.building_id]
  );
  if (!buildingOk.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  if (current.status !== 'REQUESTED') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  try {
    const updated = await withTransaction(pool, async (db) => {
      const res = await db.query<{
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
        `UPDATE reservations
         SET status = $2, updated_at = $3
         WHERE id = $1
         RETURNING id, client_id, building_id, unit_id, common_area_id, created_by_user_id, start_at, end_at, status, cancelled_at, deleted_at, created_at, updated_at`,
        [id, newStatus, now]
      );
      await insertAuditLog(db, {
        clientId: current.client_id,
        userId: user.id,
        action: 'UPDATE',
        entity: 'Reservation',
        entityId: id,
        metadata: { action },
        oldData: current,
        newData: res.rows[0],
      });
      return res;
    });
    return NextResponse.json({ reservation: toEntity(updated.rows[0]) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
