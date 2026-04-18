import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { ChecklistTemplate } from '@/lib/types';

function toTemplate(row: {
  id: string;
  client_id: string;
  building_id: string;
  is_private?: boolean;
  task_id?: string | null;
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

async function ensureCanManageTemplate(pool: ReturnType<typeof getPool>, user: Awaited<ReturnType<typeof getSessionUser>>, template: { building_id: string }) {
  if (!user) return false;
  if (!canBypassTenantScope(user) && !user.clientId) return false;
  if (user.internalRole !== 'BUILDING_ADMIN' && user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') return false;

  if (user.internalRole === 'BUILDING_ADMIN') {
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM user_building_assignments
       WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
       LIMIT 1`,
      [user.id, template.building_id]
    );
    return Boolean(ok.rows[0]);
  }
  return true;
}

async function getTemplateUsage(pool: ReturnType<typeof getPool>, templateId: string) {
  const [activeTasks, activeExecutions, anyTasks, anyExecutions] = await Promise.all([
    pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM tasks
       WHERE checklist_template_id = $1
         AND status <> 'APPROVED'
       LIMIT 1`,
      [templateId]
    ),
    pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM checklist_executions
       WHERE template_id = $1
         AND deleted_at IS NULL
         AND status <> 'APPROVED'
       LIMIT 1`,
      [templateId]
    ),
    pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM tasks
       WHERE checklist_template_id = $1
       LIMIT 1`,
      [templateId]
    ),
    pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM checklist_executions
       WHERE template_id = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [templateId]
    ),
  ]);

  return {
    hasActiveUse: Boolean(activeTasks.rows[0] || activeExecutions.rows[0]),
    hasHistoricalUse: Boolean(anyTasks.rows[0] || anyExecutions.rows[0]),
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (!canBypassTenantScope(user) && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const pool = getPool();
  const currentRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    is_private: boolean;
    task_id: string | null;
    name: string;
    description: string | null;
    items: unknown;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, building_id, is_private, task_id, name, description, items, created_at, updated_at, deleted_at
     FROM checklist_templates
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current) return NextResponse.json({ template: null }, { status: 404 });
  if (!canBypassTenantScope(user) && current.client_id !== user.clientId) return NextResponse.json({ template: null }, { status: 404 });

  if (!current.is_private) {
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
    return NextResponse.json({ template: toTemplate(current) });
  }

  if (!current.task_id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  if (user.internalRole === 'STAFF') {
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM tasks
       WHERE id = $1 AND assigned_to_user_id = $2 AND checklist_template_id = $3
       LIMIT 1`,
      [current.task_id, user.id, current.id]
    );
    if (!ok.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ template: toTemplate(current) });
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

  return NextResponse.json({ template: toTemplate(current) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canBypassTenantScope(user) && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const rawItems = Array.isArray(body?.items) ? body.items : null;
  const items =
    rawItems && rawItems.every((it: unknown) => typeof (it as { label?: unknown }).label === 'string' && typeof (it as { required?: unknown }).required === 'boolean')
      ? (rawItems as Array<{ label: string; required: boolean }>).map((it) => ({ label: it.label.trim(), required: it.required }))
      : null;

  if (!name || !items || items.length === 0 || items.some((it) => !it.label)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const pool = getPool();
  const currentRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    is_private: boolean;
    name: string;
    description: string | null;
    items: unknown;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, building_id, is_private, name, description, items, created_at, updated_at, deleted_at
     FROM checklist_templates
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current || current.deleted_at) return NextResponse.json({ template: null }, { status: 404 });
  if (!canBypassTenantScope(user) && current.client_id !== user.clientId) return NextResponse.json({ template: null }, { status: 404 });
  if (current.is_private) return NextResponse.json({ error: 'No se puede editar un checklist manual por tarea.' }, { status: 403 });

  const canManage = await ensureCanManageTemplate(pool, user, { building_id: current.building_id });
  if (!canManage) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const usage = await getTemplateUsage(pool, id);
  if (usage.hasActiveUse) {
    return NextResponse.json({ error: 'No se puede editar un checklist con tareas o ejecuciones activas.' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const hydratedItems = items.map((it, idx) => ({
    id: `chk_i_${idx + 1}_${randomUUID().slice(0, 8)}`,
    label: it.label,
    required: it.required,
  }));

  try {
    const entity = await withTransaction(pool, async (db) => {
      let entity: ChecklistTemplate;
      if (usage.hasHistoricalUse) {
        const replacementId = `chk_tpl_${Date.now()}_${randomUUID().slice(0, 8)}`;
        const insertedRes = await db.query<{
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
          `INSERT INTO checklist_templates (id, client_id, building_id, name, description, items, status, created_by_user_id, created_at, updated_at, is_private, task_id)
           VALUES ($1, $2, $3, $4, NULL, $5::jsonb, 'ACTIVE', $6, $7, $7, false, NULL)
           RETURNING id, client_id, building_id, name, description, items, created_at, updated_at, deleted_at`,
          [replacementId, current.client_id, current.building_id, name, JSON.stringify(hydratedItems), user.id, now]
        );
        await db.query(
          `UPDATE checklist_templates
           SET deleted_at = $2, updated_at = $2
           WHERE id = $1`,
          [id, now]
        );
        entity = toTemplate(insertedRes.rows[0]);
      } else {
        const updatedRes = await db.query<{
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
          `UPDATE checklist_templates
           SET name = $2, items = $3::jsonb, updated_at = $4
           WHERE id = $1
           RETURNING id, client_id, building_id, name, description, items, created_at, updated_at, deleted_at`,
          [id, name, JSON.stringify(hydratedItems), now]
        );
        entity = toTemplate(updatedRes.rows[0]);
      }

      await insertAuditLog(db, {
        clientId: current.client_id,
        userId: user.id,
        action: 'UPDATE',
        entity: 'ChecklistTemplate',
        entityId: entity.id,
        metadata: { buildingId: entity.buildingId, replacedTemplateId: usage.hasHistoricalUse ? current.id : null },
        oldData: toTemplate(current),
        newData: entity,
      });

      return entity;
    });

    return NextResponse.json({ template: entity });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canBypassTenantScope(user) && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const pool = getPool();
  const currentRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    is_private: boolean;
    name: string;
    description: string | null;
    items: unknown;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, building_id, is_private, name, description, items, created_at, updated_at, deleted_at
     FROM checklist_templates
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current || current.deleted_at) return NextResponse.json({ ok: false }, { status: 404 });
  if (!canBypassTenantScope(user) && current.client_id !== user.clientId) return NextResponse.json({ ok: false }, { status: 404 });
  if (current.is_private) return NextResponse.json({ error: 'No se puede eliminar un checklist manual por tarea.' }, { status: 403 });

  const canManage = await ensureCanManageTemplate(pool, user, { building_id: current.building_id });
  if (!canManage) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const usage = await getTemplateUsage(pool, id);
  if (usage.hasActiveUse) {
    return NextResponse.json({ error: 'No se puede eliminar un checklist con tareas o ejecuciones activas.' }, { status: 403 });
  }

  const now = new Date().toISOString();
  try {
    await withTransaction(pool, async (db) => {
      await db.query(`UPDATE checklist_templates SET deleted_at = $2, updated_at = $2 WHERE id = $1`, [id, now]);
      await insertAuditLog(db, {
        clientId: current.client_id,
        userId: user.id,
        action: 'DELETE',
        entity: 'ChecklistTemplate',
        entityId: id,
        metadata: { buildingId: current.building_id },
        oldData: toTemplate(current),
      });
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
