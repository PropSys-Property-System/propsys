import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { Unit } from '@/lib/types';

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ units: [] as Unit[] });

  const tenantWhere = bypassTenant ? '' : 'AND u.client_id = $2';
  const tenantParams = bypassTenant ? [user.id] : [user.id, user.clientId];

  if (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER') {
    const rows = await pool.query<{
      id: string;
      client_id: string;
      building_id: string;
      number: string;
      floor: string | null;
      owner_id: string | null;
      resident_id: string | null;
    }>(
      `SELECT
         u.id, u.client_id, u.building_id, u.number, u.floor,
         owner.user_id as owner_id,
         occupant.user_id as resident_id
       FROM units u
       LEFT JOIN user_unit_assignments owner ON owner.unit_id = u.id AND owner.assignment_type = 'OWNER' AND owner.status = 'ACTIVE' AND owner.deleted_at IS NULL
       LEFT JOIN user_unit_assignments occupant ON occupant.unit_id = u.id AND occupant.assignment_type = 'OCCUPANT' AND occupant.status = 'ACTIVE' AND occupant.deleted_at IS NULL
      WHERE u.status = 'ACTIVE'
      ${bypassTenant ? '' : 'AND u.client_id = $1'}
       ORDER BY u.building_id ASC, u.number ASC`,
      bypassTenant ? [] : [user.clientId]
    );

    const units: Unit[] = rows.rows.map((u) => ({
      id: u.id,
      clientId: u.client_id,
      buildingId: u.building_id,
      number: u.number,
      floor: u.floor ?? '',
      ownerId: u.owner_id ?? undefined,
      residentId: u.resident_id ?? undefined,
    }));

    return NextResponse.json({ units });
  }

  if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
    const rows = await pool.query<{
      id: string;
      client_id: string;
      building_id: string;
      number: string;
      floor: string | null;
      owner_id: string | null;
      resident_id: string | null;
    }>(
      `SELECT
         u.id, u.client_id, u.building_id, u.number, u.floor,
         owner.user_id as owner_id,
         occupant.user_id as resident_id
       FROM units u
       JOIN user_building_assignments uba ON uba.building_id = u.building_id
       LEFT JOIN user_unit_assignments owner ON owner.unit_id = u.id AND owner.assignment_type = 'OWNER' AND owner.status = 'ACTIVE' AND owner.deleted_at IS NULL
       LEFT JOIN user_unit_assignments occupant ON occupant.unit_id = u.id AND occupant.assignment_type = 'OCCUPANT' AND occupant.status = 'ACTIVE' AND occupant.deleted_at IS NULL
       WHERE uba.user_id = $1 AND uba.status = 'ACTIVE' AND uba.deleted_at IS NULL AND u.status = 'ACTIVE'
       ${tenantWhere}
       ORDER BY u.building_id ASC, u.number ASC`,
      tenantParams
    );

    const units: Unit[] = rows.rows.map((u) => ({
      id: u.id,
      clientId: u.client_id,
      buildingId: u.building_id,
      number: u.number,
      floor: u.floor ?? '',
      ownerId: u.owner_id ?? undefined,
      residentId: u.resident_id ?? undefined,
    }));

    return NextResponse.json({ units });
  }

  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    const rows = await pool.query<{
      id: string;
      client_id: string;
      building_id: string;
      number: string;
      floor: string | null;
      owner_id: string | null;
      resident_id: string | null;
    }>(
      `SELECT
         u.id, u.client_id, u.building_id, u.number, u.floor,
         owner.user_id as owner_id,
         occupant.user_id as resident_id
       FROM units u
       JOIN user_unit_assignments uua ON uua.unit_id = u.id
       LEFT JOIN user_unit_assignments owner ON owner.unit_id = u.id AND owner.assignment_type = 'OWNER' AND owner.status = 'ACTIVE' AND owner.deleted_at IS NULL
       LEFT JOIN user_unit_assignments occupant ON occupant.unit_id = u.id AND occupant.assignment_type = 'OCCUPANT' AND occupant.status = 'ACTIVE' AND occupant.deleted_at IS NULL
       WHERE uua.user_id = $1 AND uua.status = 'ACTIVE' AND uua.deleted_at IS NULL AND u.status = 'ACTIVE'
         ${user.internalRole === 'OWNER' ? "AND uua.assignment_type = 'OWNER'" : "AND uua.assignment_type = 'OCCUPANT'"}
         ${tenantWhere}
       ORDER BY u.building_id ASC, u.number ASC`,
      tenantParams
    );

    const units: Unit[] = rows.rows.map((u) => ({
      id: u.id,
      clientId: u.client_id,
      buildingId: u.building_id,
      number: u.number,
      floor: u.floor ?? '',
      ownerId: u.owner_id ?? undefined,
      residentId: u.resident_id ?? undefined,
    }));

    return NextResponse.json({ units });
  }

  return NextResponse.json({ units: [] as Unit[] });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const buildingId = typeof body?.buildingId === 'string' ? body.buildingId.trim() : '';
  const number = typeof body?.number === 'string' ? body.number.trim() : '';
  const floor = typeof body?.floor === 'string' ? body.floor.trim() : '';

  if (!buildingId || !number) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  const pool = getPool();
  const buildingRes = await pool.query<{ id: string; client_id: string }>(
    `SELECT id, client_id
     FROM buildings
     WHERE id = $1 AND status = 'ACTIVE'
     LIMIT 1`,
    [buildingId]
  );
  const building = buildingRes.rows[0];
  if (!building) return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });

  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && (!user.clientId || user.clientId !== building.client_id)) {
    return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });
  }

  const duplicateRes = await pool.query<{ id: string }>(
    `SELECT id
     FROM units
     WHERE building_id = $1
       AND status = 'ACTIVE'
       AND lower(trim(number)) = lower(trim($2))
     LIMIT 1`,
    [buildingId, number]
  );
  if (duplicateRes.rows[0]) {
    return NextResponse.json({ error: 'Ya existe una unidad con ese numero en este edificio.' }, { status: 409 });
  }

  const id = `unit_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  try {
    const created = await withTransaction(pool, async (db) => {
      const createdRes = await db.query<{
        id: string;
        client_id: string;
        building_id: string;
        number: string;
        floor: string | null;
      }>(
        `INSERT INTO units (id, client_id, building_id, number, floor, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $6)
         RETURNING id, client_id, building_id, number, floor`,
        [id, building.client_id, buildingId, number, floor || null, now]
      );
      const row = createdRes.rows[0];

      await insertAuditLog(db, {
        clientId: building.client_id,
        userId: user.id,
        action: 'CREATE',
        entity: 'Unit',
        entityId: row.id,
        metadata: { buildingId, number, floor },
        newData: row,
      });

      return row;
    });

    const unit: Unit = {
      id: created.id,
      clientId: created.client_id,
      buildingId: created.building_id,
      number: created.number,
      floor: created.floor ?? '',
    };

    return NextResponse.json({ unit });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoria.' }, { status: 500 });
  }
}


