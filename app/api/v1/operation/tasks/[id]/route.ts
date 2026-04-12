import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import type { TaskEntity } from '@/lib/types';
import { randomUUID } from 'node:crypto';

function toEntity(row: {
  id: string;
  client_id: string;
  building_id: string;
  checklist_template_id: string | null;
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
    checklistTemplateId: row.checklist_template_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as TaskEntity['status'],
    assignedToUserId: row.assigned_to_user_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const status =
    body?.status === 'PENDING' || body?.status === 'IN_PROGRESS' || body?.status === 'COMPLETED' || body?.status === 'APPROVED' ? body.status : null;
  const assignedToUserId = typeof body?.assignedToUserId === 'string' ? body.assignedToUserId : null;
  if (!status && !assignedToUserId) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const pool = getPool();
  const currentRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    checklist_template_id: string | null;
    assigned_to_user_id: string;
    created_by_user_id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, client_id, building_id, checklist_template_id, assigned_to_user_id, created_by_user_id, title, description, status, created_at, updated_at
     FROM tasks
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current) return NextResponse.json({ task: null }, { status: 404 });
  if (user.scope !== 'platform' && (!user.clientId || current.client_id !== user.clientId)) return NextResponse.json({ task: null }, { status: 404 });

  if (user.internalRole === 'STAFF') {
    if (assignedToUserId) return NextResponse.json({ error: 'El personal no puede reasignar tareas.' }, { status: 403 });
    if (current.assigned_to_user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (!status) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    if (status === 'APPROVED') return NextResponse.json({ error: 'El personal no puede aprobar tareas.' }, { status: 403 });
    if (current.checklist_template_id && status === 'COMPLETED') {
      return NextResponse.json({ error: 'La tarea se marca como completada al completar el checklist.' }, { status: 403 });
    }
    const currentStatus = current.status as TaskEntity['status'];
    if (currentStatus === 'APPROVED' || currentStatus === 'COMPLETED') {
      return NextResponse.json({ error: 'No puedes modificar una tarea completada o aprobada.' }, { status: 403 });
    }
    const isNoOp = currentStatus === status;
    const isAllowedTransition =
      current.checklist_template_id
        ? currentStatus === 'PENDING' && status === 'IN_PROGRESS'
        : (currentStatus === 'PENDING' && status === 'IN_PROGRESS') || (currentStatus === 'IN_PROGRESS' && status === 'COMPLETED');
    if (!isNoOp && !isAllowedTransition) {
      return NextResponse.json(
        {
          error: current.checklist_template_id
            ? 'Transición inválida. En tareas con checklist, el personal solo puede pasar de Pendiente a En progreso.'
            : 'Transición inválida. El personal solo puede pasar de Pendiente a En progreso y de En progreso a Completada.',
        },
        { status: 403 }
      );
    }
  } else {
    if (current.checklist_template_id && status && status !== current.status) {
      return NextResponse.json({ error: 'Esta tarea se gestiona por el checklist y no permite cambios manuales de estado.' }, { status: 403 });
    }
    if (status === 'APPROVED') {
      const currentStatus = current.status as TaskEntity['status'];
      if (currentStatus !== 'COMPLETED') {
        return NextResponse.json({ error: 'Solo se pueden aprobar tareas que estén Completadas.' }, { status: 403 });
      }
    }
    if ((current.status as TaskEntity['status']) === 'APPROVED') {
      return NextResponse.json({ error: 'No se puede modificar una tarea aprobada.' }, { status: 403 });
    }
    if (assignedToUserId) {
      const canAssign = await pool.query<{ ok: boolean }>(
        `SELECT true as ok
         FROM users u
         JOIN user_building_assignments uba ON uba.user_id = u.id
         WHERE u.id = $1
           AND u.internal_role = 'STAFF'
           AND u.status = 'ACTIVE'
           AND uba.building_id = $2
           AND uba.status = 'ACTIVE'
           AND uba.deleted_at IS NULL
           ${user.scope === 'platform' ? '' : 'AND uba.client_id = $3 AND u.client_id = $3'}
         LIMIT 1`,
        user.scope === 'platform' ? [assignedToUserId, current.building_id] : [assignedToUserId, current.building_id, current.client_id]
      );
      if (!canAssign.rows[0]) {
        return NextResponse.json({ error: 'La tarea solo se puede asignar a personal activo del mismo edificio.' }, { status: 400 });
      }
    }
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
  const updated = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    checklist_template_id: string | null;
    assigned_to_user_id: string;
    created_by_user_id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    `UPDATE tasks
     SET assigned_to_user_id = COALESCE($2, assigned_to_user_id),
         status = COALESCE($3, status),
         updated_at = $4
     WHERE id = $1
     RETURNING id, client_id, building_id, checklist_template_id, assigned_to_user_id, created_by_user_id, title, description, status, created_at, updated_at`,
    [id, assignedToUserId, status, now]
  );

  await pool
    .query(
      `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, old_data, new_data)
       VALUES ($1, $2, $3, 'UPDATE', 'Task', $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
      [
        `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
        current.client_id,
        user.id,
        id,
        JSON.stringify({ fromStatus: current.status, toStatus: status ?? current.status, assignedToUserId: assignedToUserId ?? current.assigned_to_user_id }),
        JSON.stringify(current),
        JSON.stringify(updated.rows[0]),
      ]
    )
    .catch(() => null);

  return NextResponse.json({ task: toEntity(updated.rows[0]) });
}
