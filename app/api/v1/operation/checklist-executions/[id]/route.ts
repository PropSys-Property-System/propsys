import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { ChecklistExecution } from '@/lib/types';

function parseTemplateItems(raw: unknown): Array<{ id: string; required: boolean }> {
  if (Array.isArray(raw)) {
    return raw
      .map((it) => (it && typeof it === 'object' ? (it as { id?: unknown; required?: unknown }) : null))
      .filter((it): it is { id?: unknown; required?: unknown } => Boolean(it))
      .filter((it) => typeof it.id === 'string')
      .map((it) => ({ id: it.id as string, required: it.required === true }));
  }
  if (typeof raw === 'string') {
    try {
      return parseTemplateItems(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }
  return [];
}

function canCompleteChecklist(params: {
  templateItems: Array<{ id: string; required: boolean }>;
  results: ChecklistExecution['results'];
}): boolean {
  const requiredIds = params.templateItems.filter((it) => it.required).map((it) => it.id);
  if (requiredIds.length === 0) return true;
  const resultByItemId = new Map(params.results.map((r) => [r.itemId, Boolean(r.value)]));
  return requiredIds.every((id) => resultByItemId.get(id) === true);
}

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
  if (!canBypassTenantScope(user) && (!user.clientId || current.client_id !== user.clientId)) return NextResponse.json({ execution: null }, { status: 404 });

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

    try {
      const entity = await withTransaction(pool, async (db) => {
        const updatedRes = await db.query<{
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
        if (entity.taskId) {
          const taskUpdated = await db.query<{ id: string }>(
            `UPDATE tasks
             SET status = 'APPROVED', updated_at = $2
             WHERE id = $1 AND checklist_template_id IS NOT NULL
             RETURNING id`,
            [entity.taskId, now]
          );
          if (taskUpdated.rows[0]) {
            await insertAuditLog(db, {
              clientId: current.client_id,
              userId: user.id,
              action: 'UPDATE',
              entity: 'Task',
              entityId: entity.taskId,
              metadata: { source: 'checklist_execution', executionId: entity.id, toStatus: 'APPROVED' },
            });
          }
        }

        await insertAuditLog(db, {
          clientId: current.client_id,
          userId: user.id,
          action: 'APPROVE',
          entity: 'ChecklistExecution',
          entityId: entity.id,
          metadata: { buildingId: entity.buildingId, templateId: entity.templateId, taskId: entity.taskId ?? null },
          oldData: toExecution(current),
          newData: entity,
        });

        return entity;
      });

      return NextResponse.json({ execution: entity });
    } catch {
      return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
    }
  }

  if (user.internalRole !== 'STAFF') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (current.assigned_to_user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (!results) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  if (action === 'COMPLETE') {
    const tplRes = await pool.query<{ items: unknown }>(
      `SELECT items
       FROM checklist_templates
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [current.template_id]
    );
    const items = parseTemplateItems(tplRes.rows[0]?.items);
    if (!canCompleteChecklist({ templateItems: items, results })) {
      return NextResponse.json({ error: 'Marca todos los items requeridos para completar el checklist.' }, { status: 400 });
    }
  }

  const nextStatus = action === 'COMPLETE' ? 'COMPLETED' : current.status;
  const completedAt = action === 'COMPLETE' ? now : current.completed_at;

  try {
    const entity = await withTransaction(pool, async (db) => {
      const updatedRes = await db.query<{
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
      if (action === 'COMPLETE' && entity.taskId) {
        const taskUpdated = await db.query<{ id: string }>(
          `UPDATE tasks
           SET status = 'COMPLETED', updated_at = $2
           WHERE id = $1 AND checklist_template_id IS NOT NULL AND status <> 'APPROVED'
           RETURNING id`,
          [entity.taskId, now]
        );
        if (taskUpdated.rows[0]) {
          await insertAuditLog(db, {
            clientId: current.client_id,
            userId: user.id,
            action: 'UPDATE',
            entity: 'Task',
            entityId: entity.taskId,
            metadata: { source: 'checklist_execution', executionId: entity.id, toStatus: 'COMPLETED' },
          });
        }
      }

      await insertAuditLog(db, {
        clientId: current.client_id,
        userId: user.id,
        action: 'UPDATE',
        entity: 'ChecklistExecution',
        entityId: entity.id,
        metadata: { buildingId: entity.buildingId, templateId: entity.templateId, taskId: entity.taskId ?? null, action },
        oldData: toExecution(current),
        newData: entity,
      });

      return entity;
    });

    return NextResponse.json({ execution: entity });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
