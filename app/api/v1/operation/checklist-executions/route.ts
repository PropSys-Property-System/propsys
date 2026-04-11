import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import type { ChecklistExecution } from '@/lib/types';

async function listBuildingIdsForUser(
  pool: ReturnType<typeof getPool>,
  user: { id: string; clientId: string | null; scope: string; internalRole: string }
) {
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

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') return NextResponse.json({ executions: [] as ChecklistExecution[] });
  if (user.scope !== 'platform' && !user.clientId) return NextResponse.json({ executions: [] as ChecklistExecution[] });

  const url = new URL(req.url);
  const taskId = url.searchParams.get('taskId');

  const pool = getPool();
  const tenantWhere = user.scope === 'platform' ? '' : 'AND client_id = $1';
  const tenantParams = user.scope === 'platform' ? [] : [user.clientId];

  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ executions: [] as ChecklistExecution[] });

  const staffExtraWhere = user.internalRole === 'STAFF' ? `AND assigned_to_user_id = $${tenantParams.length + 2}` : '';
  const taskExtraWhere = taskId ? `AND task_id = $${tenantParams.length + (user.internalRole === 'STAFF' ? 3 : 2)}` : '';

  const params: unknown[] = [];
  if (user.internalRole === 'STAFF') {
    params.push(...tenantParams, buildingIds, user.id);
    if (taskId) params.push(taskId);
  } else {
    params.push(...tenantParams, buildingIds);
    if (taskId) params.push(taskId);
  }

  const rows = await pool.query<{
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
     WHERE deleted_at IS NULL
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
       ${staffExtraWhere}
       ${taskExtraWhere}
     ORDER BY created_at DESC`,
    params
  );

  return NextResponse.json({ executions: rows.rows.map(toExecution) });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'STAFF') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const templateId = typeof body?.templateId === 'string' ? body.templateId : null;
  const taskId = typeof body?.taskId === 'string' ? body.taskId : null;
  if (!templateId) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const pool = getPool();

  const tplRes = await pool.query<{ client_id: string; building_id: string }>(
    `SELECT client_id, building_id
     FROM checklist_templates
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [templateId]
  );
  const tpl = tplRes.rows[0];
  if (!tpl) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const clientId = user.scope === 'platform' ? tpl.client_id : user.clientId;
  if (!clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (user.scope !== 'platform' && tpl.client_id !== clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const assignmentOk = await pool.query<{ ok: boolean }>(
    `SELECT true as ok
     FROM user_building_assignments
     WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
     LIMIT 1`,
    [user.id, tpl.building_id]
  );
  if (!assignmentOk.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  if (taskId) {
    const taskRes = await pool.query<{ id: string }>(
      `SELECT id
       FROM tasks
       WHERE id = $1
         AND building_id = $2
         AND assigned_to_user_id = $3
         AND client_id = $4
       LIMIT 1`,
      [taskId, tpl.building_id, user.id, clientId]
    );
    if (!taskRes.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const id = `chkexec_${Date.now()}_${randomUUID().slice(0, 8)}`;

  const created = await pool.query<{
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
    `INSERT INTO checklist_executions (id, client_id, building_id, unit_id, task_id, template_id, assigned_to_user_id, status, results, created_at, updated_at)
     VALUES ($1, $2, $3, NULL, $4, $5, $6, 'PENDING', '[]'::jsonb, $7, $7)
     RETURNING id, client_id, building_id, unit_id, task_id, template_id, assigned_to_user_id, status, results, created_at, updated_at, completed_at, approved_at, deleted_at`,
    [id, clientId, tpl.building_id, taskId, templateId, user.id, now]
  );

  const entity = toExecution(created.rows[0]);

  await pool
    .query(
      `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, new_data)
       VALUES ($1, $2, $3, 'CREATE', 'ChecklistExecution', $4, $5::jsonb, $6::jsonb)`,
      [
        `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
        clientId,
        user.id,
        entity.id,
        JSON.stringify({ buildingId: entity.buildingId, templateId: entity.templateId, taskId: entity.taskId ?? null }),
        JSON.stringify(entity),
      ]
    )
    .catch(() => null);

  return NextResponse.json({ execution: entity });
}


