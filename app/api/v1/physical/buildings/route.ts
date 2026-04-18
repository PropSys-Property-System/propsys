import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import type { Building } from '@/lib/types';

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ buildings: [] as Building[] });

  const pool = getPool();
  const tenantWhere = bypassTenant ? '' : 'WHERE b.client_id = $1';
  const tenantParams = bypassTenant ? [] : [user.clientId];

  if (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER') {
    const rows = await pool.query<{
      id: string;
      client_id: string;
      name: string;
      address: string | null;
      city: string | null;
    }>(`SELECT b.id, b.client_id, b.name, b.address, b.city FROM buildings b ${tenantWhere} ORDER BY b.name ASC`, tenantParams);

    const buildings: Building[] = rows.rows.map((b) => ({
      id: b.id,
      clientId: b.client_id,
      name: b.name,
      address: b.address ?? '',
      city: b.city ?? '',
    }));

    return NextResponse.json({ buildings });
  }

  if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
    const rows = await pool.query<{
      id: string;
      client_id: string;
      name: string;
      address: string | null;
      city: string | null;
    }>(
      `SELECT b.id, b.client_id, b.name, b.address, b.city
       FROM buildings b
       JOIN user_building_assignments uba ON uba.building_id = b.id
       WHERE uba.user_id = $1 AND uba.status = 'ACTIVE' AND uba.deleted_at IS NULL
       ${bypassTenant ? '' : 'AND b.client_id = $2'}
       ORDER BY b.name ASC`,
      bypassTenant ? [user.id] : [user.id, user.clientId]
    );

    const buildings: Building[] = rows.rows.map((b) => ({
      id: b.id,
      clientId: b.client_id,
      name: b.name,
      address: b.address ?? '',
      city: b.city ?? '',
    }));

    return NextResponse.json({ buildings });
  }

  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    const rows = await pool.query<{
      id: string;
      client_id: string;
      name: string;
      address: string | null;
      city: string | null;
    }>(
      `SELECT DISTINCT b.id, b.client_id, b.name, b.address, b.city
       FROM buildings b
       JOIN units u ON u.building_id = b.id
       JOIN user_unit_assignments uua ON uua.unit_id = u.id
       WHERE uua.user_id = $1
         AND uua.status = 'ACTIVE'
         AND uua.deleted_at IS NULL
         ${user.internalRole === 'OWNER' ? "AND uua.assignment_type = 'OWNER'" : "AND uua.assignment_type = 'OCCUPANT'"}
         ${bypassTenant ? '' : 'AND b.client_id = $2'}
       ORDER BY b.name ASC`,
      bypassTenant ? [user.id] : [user.id, user.clientId]
    );

    const buildings: Building[] = rows.rows.map((b) => ({
      id: b.id,
      clientId: b.client_id,
      name: b.name,
      address: b.address ?? '',
      city: b.city ?? '',
    }));

    return NextResponse.json({ buildings });
  }

  return NextResponse.json({ buildings: [] as Building[] });
}


