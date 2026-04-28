import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import type { User } from '@/lib/types';
import { canUseMockSession, getSessionUser } from '@/lib/server/auth/get-session-user';
import { mapInternalRoleToUIRole } from '@/lib/auth/role-mapping';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import type { InternalRole } from '@/lib/types/auth';
import { getSessionIdFromRequest } from '@/lib/server/auth/session-cookie';
import { MOCK_ROOT_ADMIN, MOCK_USERS } from '@/lib/mocks';
import { MOCK_USER_BUILDING_ASSIGNMENTS, MOCK_USER_UNIT_ASSIGNMENTS } from '@/lib/mocks/physical';

export async function GET(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (sessionId?.startsWith('mock_')) {
    if (!canUseMockSession()) return NextResponse.json({ user: null }, { status: 401 });
    const userId = sessionId.slice('mock_'.length);
    const u = [MOCK_ROOT_ADMIN, ...MOCK_USERS].find((x) => x.id === userId);
    if (!u) return NextResponse.json({ user: null }, { status: 401 });
    const buildingAssignments = MOCK_USER_BUILDING_ASSIGNMENTS.filter((x) => x.userId === u.id).map((x) => ({
      id: x.id,
      client_id: x.clientId,
      user_id: x.userId,
      building_id: x.buildingId,
      status: x.status,
      created_at: x.createdAt,
      updated_at: x.updatedAt,
      deleted_at: null,
    }));
    const unitAssignments = MOCK_USER_UNIT_ASSIGNMENTS.filter((x) => x.userId === u.id).map((x) => ({
      id: x.id,
      client_id: x.clientId,
      user_id: x.userId,
      unit_id: x.unitId,
      assignment_type: x.assignmentType,
      status: x.status,
      created_at: x.createdAt,
      updated_at: x.updatedAt,
      deleted_at: null,
    }));
    return NextResponse.json({ user: u, buildingAssignments, unitAssignments });
  }

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

