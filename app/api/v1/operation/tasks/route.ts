import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import type { TaskEntity } from '@/lib/types';
import { randomUUID } from 'node:crypto';

async function listBuildingIdsForUser(pool: ReturnType<typeof getPool>, user: { id: string; clientId: string | null; scope: string; internalRole: string }) {
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

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') return NextResponse.json({ tasks: [] });
  if (user.scope !== 'platform' && !user.clientId) return NextResponse.json({ tasks: [] });

  const pool = getPool();
  const tenantWhere = user.scope === 'platform' ? '' : 'AND client_id = $1';
  const tenantParams = user.scope === 'platform' ? [] : [user.clientId];

  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ tasks: [] });

  const staffExtraWhere = user.internalRole === 'STAFF' ? `AND assigned_to_user_id = $${tenantParams.length + 2}` : '';

  const rows = await pool.query<{
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
     WHERE 1=1
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
       ${staffExtraWhere}
     ORDER BY created_at DESC`,
    user.internalRole === 'STAFF' ? [...tenantParams, buildingIds, user.id] : [...tenantParams, buildingIds]
  );

  return NextResponse.json({ tasks: rows.rows.map(toEntity) });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'BUILDING_ADMIN' && user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (user.scope !== 'platform' && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const buildingId = typeof body?.buildingId === 'string' ? body.buildingId : null;
  const assignedToUserId = typeof body?.assignedToUserId === 'string' ? body.assignedToUserId : null;
  const checklistTemplateId = typeof body?.checklistTemplateId === 'string' ? body.checklistTemplateId : null;
  const rawManualChecklistItems = Array.isArray(body?.manualChecklistItems) ? body.manualChecklistItems : null;
  const manualChecklistName = typeof body?.manualChecklistName === 'string' ? body.manualChecklistName.trim() : '';
  const manualChecklistItems =
    rawManualChecklistItems &&
    rawManualChecklistItems.every(
      (it: unknown) =>
        typeof (it as { label?: unknown }).label === 'string' &&
        typeof (it as { required?: unknown }).required === 'boolean' &&
        typeof (it as { order?: unknown }).order === 'number'
    )
      ? (rawManualChecklistItems as Array<{ label: string; required: boolean; order: number }>)
          .map((it) => ({ label: it.label.trim(), required: it.required, order: it.order }))
          .sort((a, b) => a.order - b.order)
      : null;
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';

  if (!buildingId || !assignedToUserId || !title) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  if (manualChecklistItems && manualChecklistItems.length === 0) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  if (manualChecklistItems && manualChecklistItems.some((it) => !it.label)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  if (manualChecklistItems && checklistTemplateId) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const pool = getPool();
  const buildingRes = await pool.query<{ client_id: string }>('SELECT client_id FROM buildings WHERE id = $1 LIMIT 1', [buildingId]);
  const building = buildingRes.rows[0];
  if (!building) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const clientId = user.scope === 'platform' ? building.client_id : user.clientId;
  if (!clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (user.scope !== 'platform' && building.client_id !== clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  if (user.internalRole === 'BUILDING_ADMIN') {
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM user_building_assignments
       WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
       LIMIT 1`,
      [user.id, buildingId]
    );
    if (!ok.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

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
    user.scope === 'platform' ? [assignedToUserId, buildingId] : [assignedToUserId, buildingId, clientId]
  );
  if (!canAssign.rows[0]) {
    return NextResponse.json({ error: 'La tarea solo se puede asignar a personal activo del mismo edificio.' }, { status: 400 });
  }

  if (checklistTemplateId) {
    const tpl = await pool.query<{ id: string }>(
      `SELECT id
       FROM checklist_templates
       WHERE id = $1
         AND building_id = $2
         AND is_private = false
         AND deleted_at IS NULL
         ${user.scope === 'platform' ? '' : 'AND client_id = $3'}
       LIMIT 1`,
      user.scope === 'platform' ? [checklistTemplateId, buildingId] : [checklistTemplateId, buildingId, clientId]
    );
    if (!tpl.rows[0]) return NextResponse.json({ error: 'Checklist inválido para el edificio.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const status: TaskEntity['status'] = 'PENDING';
  const id = `task_${Date.now()}_${randomUUID().slice(0, 8)}`;

  if (manualChecklistItems) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO tasks (id, client_id, building_id, checklist_template_id, assigned_to_user_id, created_by_user_id, title, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $9)
         RETURNING id`,
        [id, clientId, buildingId, assignedToUserId, user.id, title, description || null, status, now]
      );

      const templateId = `chk_tpl_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const templateName = manualChecklistName || 'Checklist manual';
      const items = manualChecklistItems.map((it, idx) => ({
        id: `chk_i_${idx + 1}_${randomUUID().slice(0, 8)}`,
        label: it.label,
        required: it.required,
      }));

      await client.query(
        `INSERT INTO checklist_templates (id, client_id, building_id, name, description, items, status, created_by_user_id, deleted_at, created_at, updated_at, is_private, task_id)
         VALUES ($1, $2, $3, $4, NULL, $5::jsonb, 'ACTIVE', $6, NULL, $7, $7, true, $8)`,
        [templateId, clientId, buildingId, templateName, JSON.stringify(items), user.id, now, id]
      );

      const updatedTask = await client.query<{
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
         SET checklist_template_id = $2, updated_at = $3
         WHERE id = $1
         RETURNING id, client_id, building_id, checklist_template_id, assigned_to_user_id, created_by_user_id, title, description, status, created_at, updated_at`,
        [id, templateId, now]
      );

      await client.query('COMMIT');

      await pool
        .query(
          `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, new_data)
           VALUES ($1, $2, $3, 'CREATE', 'Task', $4, $5::jsonb, $6::jsonb)`,
          [
            `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
            clientId,
            user.id,
            id,
            JSON.stringify({ buildingId, assignedToUserId, checklistTemplateId: templateId, status, manualChecklist: true }),
            JSON.stringify(updatedTask.rows[0]),
          ]
        )
        .catch(() => null);

      return NextResponse.json({ task: toEntity(updatedTask.rows[0]) });
    } catch {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No pudimos crear la tarea.' }, { status: 500 });
    } finally {
      client.release();
    }
  }

  const row = await pool.query<{
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
    `INSERT INTO tasks (id, client_id, building_id, checklist_template_id, assigned_to_user_id, created_by_user_id, title, description, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     RETURNING id, client_id, building_id, checklist_template_id, assigned_to_user_id, created_by_user_id, title, description, status, created_at, updated_at`,
    [id, clientId, buildingId, checklistTemplateId, assignedToUserId, user.id, title, description || null, status, now]
  );

  await pool
    .query(
      `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, new_data)
       VALUES ($1, $2, $3, 'CREATE', 'Task', $4, $5::jsonb, $6::jsonb)`,
      [
        `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
        clientId,
        user.id,
        id,
        JSON.stringify({ buildingId, assignedToUserId, checklistTemplateId, status }),
        JSON.stringify(row.rows[0]),
      ]
    )
    .catch(() => null);

  return NextResponse.json({ task: toEntity(row.rows[0]) });
}
