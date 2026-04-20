import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import type { User } from '@/lib/types';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { mapInternalRoleToUIRole } from '@/lib/auth/role-mapping';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import type { InternalRole } from '@/lib/types/auth';

export async function GET(req: Request) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ user: null }, { status: 401 });

  const pool = getPool();

  let role: User['role'];
  try {
    role = mapInternalRoleToUIRole(sessionUser.internalRole as InternalRole);
  } catch {
    return NextResponse.json({ user: null }, { status: 500 });
  }

  const bypassTenant = canBypassTenantScope(sessionUser);
  const tenantWhere = bypassTenant ? '' : 'AND client_id = $2';
  const tenantParams = bypassTenant ? [sessionUser.id] : [sessionUser.id, sessionUser.clientId];

  const buildingAssignmentsRes = await pool.query<{
    id: string;
    client_id: string;
    user_id: string;
    building_id: string;
    status: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, user_id, building_id, status, created_at, updated_at, deleted_at
     FROM user_building_assignments
     WHERE user_id = $1 ${tenantWhere} AND status = 'ACTIVE' AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    tenantParams
  );

  const unitAssignmentsRes = await pool.query<{
    id: string;
    client_id: string;
    user_id: string;
    unit_id: string;
    assignment_type: string;
    status: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, user_id, unit_id, assignment_type, status, created_at, updated_at, deleted_at
     FROM user_unit_assignments
     WHERE user_id = $1 ${tenantWhere} AND status = 'ACTIVE' AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    tenantParams
  );

  const user: User = {
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.name,
    role,
    internalRole: sessionUser.internalRole as User['internalRole'],
    clientId: sessionUser.clientId,
    scope: sessionUser.scope as User['scope'],
    status: sessionUser.status as User['status'],
    buildingId: buildingAssignmentsRes.rows[0]?.building_id,
    unitId: unitAssignmentsRes.rows[0]?.unit_id,
  };

  return NextResponse.json({ user, buildingAssignments: buildingAssignmentsRes.rows, unitAssignments: unitAssignmentsRes.rows });
}

