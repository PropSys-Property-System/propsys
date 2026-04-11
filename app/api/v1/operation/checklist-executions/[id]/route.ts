import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import type { ChecklistExecution } from '@/lib/types';

function toExecution(row: {
  id: string;
  client_id: string;
  building_id: string;
  unit_id: string | null;
  task_id: string | null;
  template_id: string;
  assigned_to_user_id: string;
  status: string;
  results: unknown;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  approved_at: string | null;
  deleted_at: string | null;
}): ChecklistExecution {
  return {
    id: row.id,
    clientId: row.client_id,
    buildingId: row.building_id,
    unitId: row.unit_id ?? undefined,
    taskId: row.task_id ?? undefined,
    templateId: row.template_id,
    assignedToUserId: row.assigned_to_user_id,
    status: row.status as ChecklistExecution['status'],
    results: Array.isArray(row.results) ? (row.results as ChecklistExecution['results']) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    deletedAt: row.deleted_at,
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const action = body?.action === 'SAVE' || body?.action === 'COMPLETE' || body?.action === 'APPROVE' ? body.action : null;
  const results = Array.isArray(body?.results) ? (body.results as ChecklistExecution['results']) : null;
  if (!action) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const pool = getPool();
  const currentRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    unit_id: string | null;
    task_id: string | null;
    template_id: string;
    assigned_to_user_id: string;
    status: string;
    results: unknown;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    approved_at: string | null;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, building_id, unit_id, task_id, template_id, assigned_to_user_id, status, results, created_at, updated_at, completed_at, approved_at, deleted_at
     FROM checklist_executions
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current || current.deleted_at) return NextResponse.json({ execution: null }, { status: 404 });
  if (user.scope !== 'platform' && (!user.clientId || current.client_id !== user.clientId)) return NextResponse.json({ execution: null }, { status: 404 });

  const now = new Date().toISOString();

  if (action === 'APPROVE') {
    if (current.status !== 'COMPLETED') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (user.internalRole !== 'BUILDING_ADMIN' && user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (user.internalRole === 'BUILDING_ADMIN') {
      const ok = await pool.query<{ ok: boolean }>(
        `SELECT true as ok
         FROM user_building_assignments
         WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
         LIMIT 1`,
        [user.id, current.building_id]
      );
      if (!ok.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const updatedRes = await pool.query<{
      id: string;
      client_id: string;
      building_id: string;
      unit_id: string | null;
      task_id: string | null;
      template_id: string;
      assigned_to_user_id: string;
      status: string;
      results: unknown;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
      approved_at: string | null;
      deleted_at: string | null;
    }>(
      `UPDATE checklist_executions
       SET status = 'APPROVED', approved_at = $2, updated_at = $2
       WHERE id = $1
       RETURNING id, client_id, building_id, unit_id, task_id, template_id, assigned_to_user_id, status, results, created_at, updated_at, completed_at, approved_at, deleted_at`,
      [id, now]
    );

    const entity = toExecution(updatedRes.rows[0]);
    await pool
      .query(
        `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, old_data, new_data)
         VALUES ($1, $2, $3, 'APPROVE', 'ChecklistExecution', $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
        [
          `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
          current.client_id,
          user.id,
          entity.id,
          JSON.stringify({ buildingId: entity.buildingId, templateId: entity.templateId, taskId: entity.taskId ?? null }),
          JSON.stringify(toExecution(current)),
          JSON.stringify(entity),
        ]
      )
      .catch(() => null);

    return NextResponse.json({ execution: entity });
  }

  if (user.internalRole !== 'STAFF') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (current.assigned_to_user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (!results) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const nextStatus = action === 'COMPLETE' ? 'COMPLETED' : current.status;
  const completedAt = action === 'COMPLETE' ? now : current.completed_at;

  const updatedRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    unit_id: string | null;
    task_id: string | null;
    template_id: string;
    assigned_to_user_id: string;
    status: string;
    results: unknown;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
    approved_at: string | null;
    deleted_at: string | null;
  }>(
    `UPDATE checklist_executions
     SET results = $2::jsonb, status = $3, completed_at = $4, updated_at = $5
     WHERE id = $1
     RETURNING id, client_id, building_id, unit_id, task_id, template_id, assigned_to_user_id, status, results, created_at, updated_at, completed_at, approved_at, deleted_at`,
    [id, JSON.stringify(results), nextStatus, completedAt, now]
  );

  const entity = toExecution(updatedRes.rows[0]);
  await pool
    .query(
      `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, old_data, new_data)
       VALUES ($1, $2, $3, 'UPDATE', 'ChecklistExecution', $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
      [
        `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
        current.client_id,
        user.id,
        entity.id,
        JSON.stringify({ buildingId: entity.buildingId, templateId: entity.templateId, taskId: entity.taskId ?? null, action }),
        JSON.stringify(toExecution(current)),
        JSON.stringify(entity),
      ]
    )
    .catch(() => null);

  return NextResponse.json({ execution: entity });
}


