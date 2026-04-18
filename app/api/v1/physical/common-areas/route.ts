import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { CommonArea } from '@/lib/types';

type CommonAreaRow = {
  id: string;
  client_id: string;
  building_id: string;
  name: string;
  capacity: number;
  requires_approval: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function toCommonArea(area: CommonAreaRow): CommonArea {
  return {
    id: area.id,
    clientId: area.client_id,
    buildingId: area.building_id,
    name: area.name,
    capacity: area.capacity,
    requiresApproval: area.requires_approval,
  };
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const url = new URL(req.url);
  const buildingId = url.searchParams.get('buildingId') ?? '';
  if (!buildingId) return NextResponse.json({ error: 'buildingId requerido' }, { status: 400 });

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ areas: [] as CommonArea[] });

  const buildingRes = await pool.query<{ id: string; client_id: string }>('SELECT id, client_id FROM buildings WHERE id = $1 LIMIT 1', [buildingId]);
  const building = buildingRes.rows[0];
  if (!building) return NextResponse.json({ areas: [] as CommonArea[] });
  if (!bypassTenant && building.client_id !== user.clientId) return NextResponse.json({ areas: [] as CommonArea[] });

  if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM user_building_assignments
       WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
       LIMIT 1`,
      [user.id, buildingId]
    );
    if (!ok.rows[0]) return NextResponse.json({ areas: [] as CommonArea[] });
  }

  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM user_unit_assignments uua
       JOIN units u ON u.id = uua.unit_id
       WHERE uua.user_id = $1
         AND u.building_id = $2
         AND uua.status = 'ACTIVE'
         AND uua.deleted_at IS NULL
         ${user.internalRole === 'OWNER' ? "AND uua.assignment_type = 'OWNER'" : "AND uua.assignment_type = 'OCCUPANT'"}
       LIMIT 1`,
      [user.id, buildingId]
    );
    if (!ok.rows[0]) return NextResponse.json({ areas: [] as CommonArea[] });
  }

  const rows = await pool.query<CommonAreaRow>(
    `SELECT id, client_id, building_id, name, capacity, requires_approval, status, created_at, updated_at, deleted_at
     FROM common_areas
     WHERE building_id = $1
       AND status = 'ACTIVE'
       AND deleted_at IS NULL
     ORDER BY name ASC`,
    [buildingId]
  );

  const areas: CommonArea[] = rows.rows.map(toCommonArea);

  return NextResponse.json({ areas });
}

export async function PATCH(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const requiresApproval = typeof body?.requiresApproval === 'boolean' ? body.requiresApproval : null;
  if (!id || requiresApproval === null) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const pool = getPool();
  const currentRes = await pool.query<CommonAreaRow>(
    `SELECT id, client_id, building_id, name, capacity, requires_approval, status, created_at, updated_at, deleted_at
     FROM common_areas
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current || current.deleted_at || current.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Área común no encontrada' }, { status: 404 });
  }
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && (!user.clientId || current.client_id !== user.clientId)) {
    return NextResponse.json({ error: 'Área común no encontrada' }, { status: 404 });
  }

  const updatedAt = new Date().toISOString();
  try {
    const updated = await withTransaction(pool, async (db) => {
      const updatedRes = await db.query<CommonAreaRow>(
        `UPDATE common_areas
         SET requires_approval = $2, updated_at = $3
         WHERE id = $1
         RETURNING id, client_id, building_id, name, capacity, requires_approval, status, created_at, updated_at, deleted_at`,
        [id, requiresApproval, updatedAt]
      );
      const updated = updatedRes.rows[0];
      await insertAuditLog(db, {
        clientId: updated.client_id,
        userId: user.id,
        action: 'UPDATE',
        entity: 'CommonArea',
        entityId: updated.id,
        metadata: { requiresApproval },
        oldData: current,
        newData: updated,
      });
      return updated;
    });

    return NextResponse.json({ area: toCommonArea(updated) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
