import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import { randomUUID } from 'crypto';
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

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseCapacity(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.floor(value);
  return rounded >= 1 ? rounded : null;
}

async function loadAreaById(pool: ReturnType<typeof getPool>, id: string): Promise<CommonAreaRow | null> {
  const currentRes = await pool.query<CommonAreaRow>(
    `SELECT id, client_id, building_id, name, capacity, requires_approval, status, created_at, updated_at, deleted_at
     FROM common_areas
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return currentRes.rows[0] ?? null;
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const url = new URL(req.url);
  const buildingId = url.searchParams.get('buildingId') ?? '';
  const statusParam = url.searchParams.get('status');
  const requestedStatus = statusParam === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
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
       AND status = $2
       AND deleted_at IS NULL
     ORDER BY name ASC`,
    [buildingId, requestedStatus]
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
  const current = await loadAreaById(pool, id);
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

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const buildingId = normalizeText(body?.buildingId);
  const name = normalizeText(body?.name);
  const capacity = parseCapacity(body?.capacity);
  const requiresApproval = typeof body?.requiresApproval === 'boolean' ? body.requiresApproval : true;
  if (!buildingId || !name || capacity === null) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(user);
  const buildingRes = await pool.query<{ id: string; client_id: string; status: string }>(
    `SELECT id, client_id, status
     FROM buildings
     WHERE id = $1
     LIMIT 1`,
    [buildingId]
  );
  const building = buildingRes.rows[0];
  if (!building || building.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });
  }
  if (!bypassTenant && (!user.clientId || building.client_id !== user.clientId)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const duplicateRes = await pool.query<{ id: string }>(
    `SELECT id
     FROM common_areas
     WHERE building_id = $1
       AND status = 'ACTIVE'
       AND deleted_at IS NULL
       AND lower(trim(name)) = lower(trim($2))
     LIMIT 1`,
    [buildingId, name]
  );
  if (duplicateRes.rows[0]) {
    return NextResponse.json({ error: 'Ya existe un area comun activa con ese nombre.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const id = `ca_${Date.now()}_${randomUUID().slice(0, 8)}`;
  try {
    const created = await withTransaction(pool, async (db) => {
      const insertedRes = await db.query<CommonAreaRow>(
        `INSERT INTO common_areas (id, client_id, building_id, name, capacity, requires_approval, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $7)
         RETURNING id, client_id, building_id, name, capacity, requires_approval, status, created_at, updated_at, deleted_at`,
        [id, building.client_id, buildingId, name, capacity, requiresApproval, now]
      );
      const inserted = insertedRes.rows[0];
      await insertAuditLog(db, {
        clientId: building.client_id,
        userId: user.id,
        action: 'CREATE',
        entity: 'CommonArea',
        entityId: inserted.id,
        metadata: { buildingId, capacity, requiresApproval },
        newData: inserted,
      });
      return inserted;
    });

    return NextResponse.json({ area: toCommonArea(created) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoria.' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = normalizeText(body?.id);
  const name = normalizeText(body?.name);
  const capacity = parseCapacity(body?.capacity);
  const requiresApproval = typeof body?.requiresApproval === 'boolean' ? body.requiresApproval : null;
  if (!id || !name || capacity === null || requiresApproval === null) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  const pool = getPool();
  const current = await loadAreaById(pool, id);
  if (!current || current.deleted_at || current.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Área común no encontrada' }, { status: 404 });
  }
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && (!user.clientId || current.client_id !== user.clientId)) {
    return NextResponse.json({ error: 'Área común no encontrada' }, { status: 404 });
  }

  const duplicateRes = await pool.query<{ id: string }>(
    `SELECT id
     FROM common_areas
     WHERE building_id = $1
       AND status = 'ACTIVE'
       AND deleted_at IS NULL
       AND id <> $2
       AND lower(trim(name)) = lower(trim($3))
     LIMIT 1`,
    [current.building_id, current.id, name]
  );
  if (duplicateRes.rows[0]) {
    return NextResponse.json({ error: 'Ya existe un area comun activa con ese nombre.' }, { status: 409 });
  }

  const updatedAt = new Date().toISOString();
  try {
    const updated = await withTransaction(pool, async (db) => {
      const updatedRes = await db.query<CommonAreaRow>(
        `UPDATE common_areas
         SET name = $2, capacity = $3, requires_approval = $4, updated_at = $5
         WHERE id = $1
         RETURNING id, client_id, building_id, name, capacity, requires_approval, status, created_at, updated_at, deleted_at`,
        [id, name, capacity, requiresApproval, updatedAt]
      );
      const next = updatedRes.rows[0];
      await insertAuditLog(db, {
        clientId: next.client_id,
        userId: user.id,
        action: 'UPDATE',
        entity: 'CommonArea',
        entityId: next.id,
        metadata: { fields: ['name', 'capacity', 'requiresApproval'] },
        oldData: current,
        newData: next,
      });
      return next;
    });
    return NextResponse.json({ area: toCommonArea(updated) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoria.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = normalizeText(body?.id);
  const shouldRestore = body?.restore === true;
  if (!id) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const pool = getPool();
  const current = await loadAreaById(pool, id);
  if (!current || current.deleted_at) return NextResponse.json({ error: 'Área común no encontrada' }, { status: 404 });
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && (!user.clientId || current.client_id !== user.clientId)) {
    return NextResponse.json({ error: 'Área común no encontrada' }, { status: 404 });
  }

  if (!shouldRestore && current.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Área común no encontrada' }, { status: 404 });
  }
  if (shouldRestore && current.status !== 'ARCHIVED') {
    return NextResponse.json({ error: 'Área común archivada no encontrada' }, { status: 404 });
  }

  if (!shouldRestore) {
    const dependencies = await pool.query<{ total: string }>(
      `SELECT count(*)::text as total
       FROM reservations
       WHERE common_area_id = $1
         AND status IN ('REQUESTED', 'APPROVED')
         AND deleted_at IS NULL`,
      [id]
    );
    if (Number(dependencies.rows[0]?.total ?? 0) > 0) {
      return NextResponse.json({ error: 'No puedes archivar un area comun con reservas activas.' }, { status: 409 });
    }
  }

  const nextStatus = shouldRestore ? 'ACTIVE' : 'ARCHIVED';
  const action = shouldRestore ? 'RESTORE' : 'ARCHIVE';
  const now = new Date().toISOString();
  try {
    const updated = await withTransaction(pool, async (db) => {
      const updatedRes = await db.query<CommonAreaRow>(
        `UPDATE common_areas
         SET status = $2, updated_at = $3
         WHERE id = $1
         RETURNING id, client_id, building_id, name, capacity, requires_approval, status, created_at, updated_at, deleted_at`,
        [id, nextStatus, now]
      );
      const next = updatedRes.rows[0];
      await insertAuditLog(db, {
        clientId: next.client_id,
        userId: user.id,
        action,
        entity: 'CommonArea',
        entityId: next.id,
        metadata: { status: nextStatus },
        oldData: current,
        newData: next,
      });
      return next;
    });
    return NextResponse.json({ area: toCommonArea(updated) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoria.' }, { status: 500 });
  }
}
