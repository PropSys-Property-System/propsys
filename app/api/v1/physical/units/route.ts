import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
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
      ${bypassTenant ? '' : 'WHERE u.client_id = $1'}
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
       WHERE uba.user_id = $1 AND uba.status = 'ACTIVE' AND uba.deleted_at IS NULL
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
       WHERE uua.user_id = $1 AND uua.status = 'ACTIVE' AND uua.deleted_at IS NULL
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


