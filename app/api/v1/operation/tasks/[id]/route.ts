import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import type { TaskEntity } from '@/lib/types';
import { randomUUID } from 'node:crypto';

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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const status =
    body?.status === 'PENDING' || body?.status === 'IN_PROGRESS' || body?.status === 'COMPLETED' || body?.status === 'APPROVED' ? body.status : null;
  if (!status) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const pool = getPool();
  const currentRes = await pool.query<{
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
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current) return NextResponse.json({ task: null }, { status: 404 });
  if (user.scope !== 'platform' && (!user.clientId || current.client_id !== user.clientId)) return NextResponse.json({ task: null }, { status: 404 });

  if (user.internalRole === 'STAFF') {
    if (current.assigned_to_user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (status === 'APPROVED') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
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
    assigned_to_user_id: string;
    created_by_user_id: string;
    title: string;
    description: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    `UPDATE tasks
     SET status = $2, updated_at = $3
     WHERE id = $1
     RETURNING id, client_id, building_id, assigned_to_user_id, created_by_user_id, title, description, status, created_at, updated_at`,
    [id, status, now]
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
        JSON.stringify({ fromStatus: current.status, toStatus: status }),
        JSON.stringify(current),
        JSON.stringify(updated.rows[0]),
      ]
    )
    .catch(() => null);

  return NextResponse.json({ task: toEntity(updated.rows[0]) });
}

