import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import type { CommonArea, PhysicalEntityStatus } from '@/lib/types';

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const url = new URL(req.url);
  const buildingId = url.searchParams.get('buildingId') ?? '';
  if (!buildingId) return NextResponse.json({ error: 'buildingId requerido' }, { status: 400 });

  const pool = getPool();

  const buildingRes = await pool.query<{ id: string; client_id: string }>('SELECT id, client_id FROM buildings WHERE id = $1 LIMIT 1', [buildingId]);
  const building = buildingRes.rows[0];
  if (!building) return NextResponse.json({ areas: [] as CommonArea[] });
  if (user.scope !== 'platform' && building.client_id !== user.clientId) return NextResponse.json({ areas: [] as CommonArea[] });

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

  const rows = await pool.query<{
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
  }>(
    `SELECT id, client_id, building_id, name, capacity, requires_approval, status, created_at, updated_at, deleted_at
     FROM common_areas
     WHERE building_id = $1
       AND status = 'ACTIVE'
       AND deleted_at IS NULL
     ORDER BY name ASC`,
    [buildingId]
  );

  const areas: CommonArea[] = rows.rows.map((a) => ({
    id: a.id,
    clientId: a.client_id,
    buildingId: a.building_id,
    name: a.name,
    capacity: a.capacity,
    requiresApproval: a.requires_approval,
    status: a.status as PhysicalEntityStatus,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
    deletedAt: a.deleted_at,
  }));

  return NextResponse.json({ areas });
}

