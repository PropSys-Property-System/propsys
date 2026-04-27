import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { Building } from '@/lib/types';

type BuildingRow = {
  id: string;
  client_id: string;
  name: string;
  address: string | null;
  city: string | null;
  status: string;
};

function toBuilding(row: BuildingRow): Building {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    address: row.address ?? '',
    city: row.city ?? '',
  };
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const pool = getPool();
  const currentRes = await pool.query<BuildingRow>(
    `SELECT id, client_id, name, address, city, status
     FROM buildings
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current || current.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });
  }

  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && (!user.clientId || current.client_id !== user.clientId)) {
    return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });
  }

  const dependencyRes = await pool.query<{ total: string }>(
    `SELECT
       (
         (SELECT count(*) FROM units WHERE building_id = $1 AND status = 'ACTIVE') +
         (SELECT count(*) FROM common_areas WHERE building_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL) +
         (SELECT count(*) FROM tasks WHERE building_id = $1 AND status <> 'APPROVED') +
         (SELECT count(*) FROM reservations WHERE building_id = $1 AND status IN ('REQUESTED', 'APPROVED') AND deleted_at IS NULL) +
         (SELECT count(*) FROM receipts WHERE building_id = $1 AND status IN ('PENDING', 'OVERDUE'))
       )::text AS total`,
    [id]
  );
  if (Number(dependencyRes.rows[0]?.total ?? 0) > 0) {
    return NextResponse.json({ error: 'No puedes archivar un edificio con datos asociados activos.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  try {
    const archived = await withTransaction(pool, async (db) => {
      const updatedRes = await db.query<BuildingRow>(
        `UPDATE buildings
         SET status = 'ARCHIVED', updated_at = $2
         WHERE id = $1
         RETURNING id, client_id, name, address, city, status`,
        [id, now]
      );
      const updated = updatedRes.rows[0];

      await insertAuditLog(db, {
        clientId: current.client_id,
        userId: user.id,
        action: 'ARCHIVE',
        entity: 'Building',
        entityId: current.id,
        metadata: { reason: 'manual_archive' },
        oldData: current,
        newData: updated,
      });

      return updated;
    });

    return NextResponse.json({ building: toBuilding(archived) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoria.' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const pool = getPool();
  const currentRes = await pool.query<BuildingRow>(
    `SELECT id, client_id, name, address, city, status
     FROM buildings
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current || current.status !== 'ARCHIVED') {
    return NextResponse.json({ error: 'Edificio archivado no encontrado' }, { status: 404 });
  }

  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && (!user.clientId || current.client_id !== user.clientId)) {
    return NextResponse.json({ error: 'Edificio archivado no encontrado' }, { status: 404 });
  }

  const duplicateRes = await pool.query<{ id: string }>(
    `SELECT id
     FROM buildings
     WHERE client_id = $1
       AND status = 'ACTIVE'
       AND id <> $2
       AND lower(trim(name)) = lower(trim($3))
     LIMIT 1`,
    [current.client_id, current.id, current.name]
  );
  if (duplicateRes.rows[0]) {
    return NextResponse.json({ error: 'Ya existe un edificio activo con ese nombre para este cliente.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  try {
    const restored = await withTransaction(pool, async (db) => {
      const updatedRes = await db.query<BuildingRow>(
        `UPDATE buildings
         SET status = 'ACTIVE', updated_at = $2
         WHERE id = $1
         RETURNING id, client_id, name, address, city, status`,
        [id, now]
      );
      const updated = updatedRes.rows[0];

      await insertAuditLog(db, {
        clientId: current.client_id,
        userId: user.id,
        action: 'RESTORE',
        entity: 'Building',
        entityId: current.id,
        metadata: { reason: 'manual_restore' },
        oldData: current,
        newData: updated,
      });

      return updated;
    });

    return NextResponse.json({ building: toBuilding(restored) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoria.' }, { status: 500 });
  }
}
