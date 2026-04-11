import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import type { StaffMember } from '@/lib/types';

function roleLabel(internalRole: string): string {
  switch (internalRole) {
    case 'BUILDING_ADMIN':
      return 'Administrador';
    case 'STAFF':
      return 'Personal';
    default:
      return internalRole;
  }
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const buildingId = searchParams.get('buildingId');
  if (!buildingId) return NextResponse.json({ error: 'buildingId es requerido' }, { status: 400 });

  const pool = getPool();

  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
    const assignment = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM user_building_assignments
       WHERE user_id = $1
         AND building_id = $2
         AND status = 'ACTIVE'
         AND deleted_at IS NULL
       LIMIT 1`,
      [user.id, buildingId]
    );
    if (!assignment.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  } else if (user.scope !== 'platform') {
    const building = await pool.query<{ id: string }>(
      'SELECT id FROM buildings WHERE id = $1 AND client_id = $2 LIMIT 1',
      [buildingId, user.clientId]
    );
    if (!building.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const rows = await pool.query<{
    id: string;
    name: string;
    internal_role: string;
    building_id: string;
    status: string;
  }>(
    `SELECT DISTINCT u.id, u.name, u.internal_role, uba.building_id, u.status
     FROM users u
     JOIN user_building_assignments uba ON uba.user_id = u.id
     WHERE uba.building_id = $1
       AND uba.status = 'ACTIVE'
       AND uba.deleted_at IS NULL
       AND u.status IN ('ACTIVE', 'INACTIVE')
       AND u.internal_role IN ('BUILDING_ADMIN', 'STAFF')
       ${user.scope === 'platform' ? '' : 'AND uba.client_id = $2 AND u.client_id = $2'}
     ORDER BY u.internal_role ASC, u.name ASC`,
    user.scope === 'platform' ? [buildingId] : [buildingId, user.clientId]
  );

  const staff: StaffMember[] = rows.rows.map((row) => ({
    id: row.id,
    buildingId: row.building_id,
    name: row.name,
    role: roleLabel(row.internal_role),
    status: row.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
  }));

  return NextResponse.json({ staff });
}
