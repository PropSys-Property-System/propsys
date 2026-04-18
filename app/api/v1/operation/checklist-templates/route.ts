import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { ChecklistTemplate } from '@/lib/types';
import { randomUUID } from 'node:crypto';

async function listBuildingIdsForUser(
  pool: ReturnType<typeof getPool>,
  user: { id: string; clientId: string | null; scope: string; internalRole: string }
) {
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
  return [];
}

function toTemplate(row: {
  id: string;
  client_id: string;
  building_id: string;
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

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') return NextResponse.json({ templates: [] as ChecklistTemplate[] });
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ templates: [] as ChecklistTemplate[] });

  const pool = getPool();
  const tenantWhere = bypassTenant ? '' : 'AND client_id = $1';
  const tenantParams = bypassTenant ? [] : [user.clientId];

  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ templates: [] as ChecklistTemplate[] });

  const rows = await pool.query<{
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
     WHERE deleted_at IS NULL
       AND is_private = false
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
     ORDER BY created_at DESC`,
    [...tenantParams, buildingIds]
  );

  return NextResponse.json({ templates: rows.rows.map(toTemplate) });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const canCreate =
    user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'CLIENT_MANAGER' || user.internalRole === 'ROOT_ADMIN';
  if (!canCreate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const buildingId = typeof body?.buildingId === 'string' ? body.buildingId : null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const rawItems = Array.isArray(body?.items) ? body.items : null;
  const items =
    rawItems && rawItems.every((it: unknown) => typeof (it as { label?: unknown }).label === 'string' && typeof (it as { required?: unknown }).required === 'boolean')
      ? (rawItems as Array<{ label: string; required: boolean }>).map((it) => ({ label: it.label.trim(), required: it.required }))
      : null;

  if (!buildingId || !name || !items || items.length === 0 || items.some((it) => !it.label)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const pool = getPool();
  const buildingRes = await pool.query<{ client_id: string }>('SELECT client_id FROM buildings WHERE id = $1 LIMIT 1', [buildingId]);
  const building = buildingRes.rows[0];
  if (!building) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const clientId = bypassTenant ? building.client_id : user.clientId;
  if (!clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (!bypassTenant && building.client_id !== clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

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

  const now = new Date().toISOString();
  const templateId = `chk_tpl_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const hydratedItems = items.map((it, idx) => ({
    id: `chk_i_${idx + 1}_${randomUUID().slice(0, 8)}`,
    label: it.label,
    required: it.required,
  }));

  try {
    const row = await withTransaction(pool, async (db) => {
      const created = await db.query<{
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
        `INSERT INTO checklist_templates (id, client_id, building_id, name, description, items, status, created_by_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NULL, $5::jsonb, 'ACTIVE', $6, $7, $7)
         RETURNING id, client_id, building_id, name, description, items, created_at, updated_at, deleted_at`,
        [templateId, clientId, buildingId, name, JSON.stringify(hydratedItems), user.id, now]
      );

      await insertAuditLog(db, {
        clientId,
        userId: user.id,
        action: 'CREATE',
        entity: 'ChecklistTemplate',
        entityId: templateId,
        metadata: { buildingId },
        newData: created.rows[0],
      });

      return created;
    });

    return NextResponse.json({ template: toTemplate(row.rows[0]) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
