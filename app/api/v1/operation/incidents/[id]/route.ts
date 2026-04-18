import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { IncidentEntity } from '@/lib/types';

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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (user.internalRole === 'OCCUPANT' || user.internalRole === 'OWNER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const status =
    body?.status === 'REPORTED' || body?.status === 'ASSIGNED' || body?.status === 'IN_PROGRESS' || body?.status === 'RESOLVED' || body?.status === 'CLOSED'
      ? body.status
      : null;
  if (!status) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const pool = getPool();
  const currentRes = await pool.query<{
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
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current) return NextResponse.json({ incident: null }, { status: 404 });
  if (!canBypassTenantScope(user) && (!user.clientId || current.client_id !== user.clientId)) return NextResponse.json({ incident: null }, { status: 404 });

  if (user.internalRole === 'STAFF') {
    const canTouchIncident =
      current.assigned_to_user_id === user.id || current.reported_by_user_id === user.id;
    if (!canTouchIncident) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (current.status === 'RESOLVED' || current.status === 'CLOSED') {
      return NextResponse.json({ error: 'No puedes modificar una incidencia resuelta o cerrada.' }, { status: 403 });
    }
    if (status === 'CLOSED') {
      return NextResponse.json({ error: 'El personal no puede cerrar incidencias.' }, { status: 403 });
    }
    if (status !== 'IN_PROGRESS' && status !== 'RESOLVED') {
      return NextResponse.json({ error: 'El personal solo puede marcar incidencias como En progreso o Resueltas.' }, { status: 403 });
    }
  }

  if (status === 'ASSIGNED' && !current.assigned_to_user_id) {
    return NextResponse.json({ error: 'No se puede marcar como asignada sin responsable.' }, { status: 400 });
  }

  if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM user_building_assignments
       WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
       LIMIT 1`,
      [user.id, current.building_id]
    );
    if (!ok.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const now = new Date().toISOString();
  try {
    const updated = await withTransaction(pool, async (db) => {
      const res = await db.query<{
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
        `UPDATE incidents
         SET status = $2, updated_at = $3
         WHERE id = $1
         RETURNING id, client_id, building_id, unit_id, title, description, status, priority, reported_by_user_id, assigned_to_user_id, created_at, updated_at`,
        [id, status, now]
      );

      await insertAuditLog(db, {
        clientId: current.client_id,
        userId: user.id,
        action: 'UPDATE',
        entity: 'Incident',
        entityId: id,
        metadata: { fromStatus: current.status, toStatus: status },
        oldData: current,
        newData: res.rows[0],
      });
      return res;
    });

    return NextResponse.json({ incident: toEntity(updated.rows[0]) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
