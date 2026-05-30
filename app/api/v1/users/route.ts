import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { mapInternalRoleToUIRole } from '@/lib/auth/role-mapping';
import type { User } from '@/lib/types';

const DIRECT_USER_CREATION_DEPRECATED_MESSAGE =
  'La creación directa de usuarios fue reemplazada por invitaciones. Usa /api/v1/users/invitations.';

function toUser(row: {
  id: string;
  email: string;
  name: string;
  internal_role: string;
  client_id: string | null;
  scope: string;
  status: string;
  building_id?: string | null;
  unit_id?: string | null;
}): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: mapInternalRoleToUIRole(row.internal_role as User['internalRole']),
    internalRole: row.internal_role as User['internalRole'],
    clientId: row.client_id,
    scope: row.scope as User['scope'],
    status: row.status as User['status'],
    buildingId: row.building_id ?? undefined,
    unitId: row.unit_id ?? undefined,
  };
}

export async function GET(req: Request) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (sessionUser.internalRole !== 'ROOT_ADMIN' && sessionUser.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ users: [] as User[] });
  }

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(sessionUser);
  if (!bypassTenant && !sessionUser.clientId) return NextResponse.json({ users: [] as User[] });
  const rows = await pool.query<{
    id: string;
    email: string;
    name: string;
    internal_role: string;
    client_id: string | null;
    scope: string;
    status: string;
    building_id: string | null;
    unit_id: string | null;
  }>(
    bypassTenant
      ? `SELECT u.id, u.email, u.name, u.internal_role, u.client_id, u.scope, u.status,
            COALESCE(uba.building_id, uua.building_id) AS building_id,
            uua.unit_id
         FROM users u
         LEFT JOIN LATERAL (
           SELECT building_id
           FROM user_building_assignments
           WHERE user_id = u.id
             AND client_id = u.client_id
             AND status = 'ACTIVE'
             AND deleted_at IS NULL
           ORDER BY updated_at DESC
           LIMIT 1
         ) uba ON true
         LEFT JOIN LATERAL (
           SELECT a.unit_id, unit.building_id
           FROM user_unit_assignments a
           JOIN units unit ON unit.id = a.unit_id
           WHERE a.user_id = u.id
             AND a.status = 'ACTIVE'
             AND a.deleted_at IS NULL
           ORDER BY CASE WHEN a.assignment_type = 'OWNER' THEN 0 ELSE 1 END, a.updated_at DESC
           LIMIT 1
         ) uua ON true
         ORDER BY u.name ASC`
      : `SELECT u.id, u.email, u.name, u.internal_role, u.client_id, u.scope, u.status,
            COALESCE(uba.building_id, uua.building_id) AS building_id,
            uua.unit_id
         FROM users u
         LEFT JOIN LATERAL (
           SELECT building_id
           FROM user_building_assignments
           WHERE user_id = u.id
             AND client_id = u.client_id
             AND status = 'ACTIVE'
             AND deleted_at IS NULL
           ORDER BY updated_at DESC
           LIMIT 1
         ) uba ON true
         LEFT JOIN LATERAL (
           SELECT a.unit_id, unit.building_id
           FROM user_unit_assignments a
           JOIN units unit ON unit.id = a.unit_id
           WHERE a.user_id = u.id
             AND a.status = 'ACTIVE'
             AND a.deleted_at IS NULL
           ORDER BY CASE WHEN a.assignment_type = 'OWNER' THEN 0 ELSE 1 END, a.updated_at DESC
           LIMIT 1
         ) uua ON true
         WHERE u.client_id = $1
         ORDER BY u.name ASC`,
    bypassTenant ? [] : [sessionUser.clientId]
  );

  const users: User[] = rows.rows.map(toUser);

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (actor.internalRole !== 'ROOT_ADMIN' && actor.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const res = NextResponse.json({ error: DIRECT_USER_CREATION_DEPRECATED_MESSAGE }, { status: 410 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}


