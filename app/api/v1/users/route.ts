import { NextResponse } from 'next/server';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { mapInternalRoleToUIRole } from '@/lib/auth/role-mapping';
import { generateStaffPassword, validateStaffPassword } from '@/lib/server/auth/staff-password';
import { withTransaction } from '@/lib/server/db/tx';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import type { User } from '@/lib/types';

const CREATABLE_INTERNAL_ROLES = ['BUILDING_ADMIN', 'STAFF', 'OWNER', 'OCCUPANT'] as const;

function normalizeText(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

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

  const body = await req.json().catch(() => null);
  const name = normalizeText(body?.name);
  const email = normalizeEmail(body?.email);
  const internalRole = CREATABLE_INTERNAL_ROLES.find((role) => role === body?.internalRole) ?? null;
  const buildingId = normalizeText(body?.buildingId) || null;
  const unitId = normalizeText(body?.unitId) || null;
  const manualPassword = normalizeText(body?.password) || null;

  if (!name || !email || !internalRole) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }
  if ((internalRole === 'BUILDING_ADMIN' || internalRole === 'STAFF') && !buildingId) {
    return NextResponse.json({ error: 'Selecciona un edificio para ese rol.' }, { status: 400 });
  }
  if ((internalRole === 'OWNER' || internalRole === 'OCCUPANT') && !unitId) {
    return NextResponse.json({ error: 'Selecciona una unidad para ese rol.' }, { status: 400 });
  }
  if (manualPassword && !validateStaffPassword(manualPassword)) {
    return NextResponse.json(
      { error: 'La contrasena debe tener al menos 12 caracteres e incluir mayuscula, minuscula, numero y simbolo.' },
      { status: 400 }
    );
  }

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(actor);
  if (!bypassTenant && !actor.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  let targetClientId: string | null = null;
  let resolvedBuildingId: string | null = buildingId;
  let resolvedUnitId: string | null = unitId;
  let assignmentType: 'OWNER' | 'OCCUPANT' | null = null;

  if (internalRole === 'BUILDING_ADMIN' || internalRole === 'STAFF') {
    const buildingRes = await pool.query<{ id: string; client_id: string }>(
      `SELECT id, client_id
       FROM buildings
       WHERE id = $1
         AND status = 'ACTIVE'
       LIMIT 1`,
      [buildingId]
    );
    const building = buildingRes.rows[0];
    if (!building) return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });
    if (!bypassTenant && building.client_id !== actor.clientId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    targetClientId = building.client_id;
  } else {
    assignmentType = internalRole === 'OWNER' ? 'OWNER' : 'OCCUPANT';
    const unitRes = await pool.query<{ id: string; building_id: string; client_id: string }>(
      `SELECT u.id, u.building_id, u.client_id
       FROM units u
       JOIN buildings b ON b.id = u.building_id
       WHERE u.id = $1
         AND u.status = 'ACTIVE'
         AND b.status = 'ACTIVE'
       LIMIT 1`,
      [unitId]
    );
    const unit = unitRes.rows[0];
    if (!unit) return NextResponse.json({ error: 'Unidad no encontrada' }, { status: 404 });
    if (!bypassTenant && unit.client_id !== actor.clientId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    targetClientId = unit.client_id;
    resolvedBuildingId = unit.building_id;
    resolvedUnitId = unit.id;

    const slotRes = await pool.query<{ id: string }>(
      `SELECT id
       FROM user_unit_assignments
       WHERE unit_id = $1
         AND assignment_type = $2
         AND status = 'ACTIVE'
         AND deleted_at IS NULL
       LIMIT 1`,
      [unit.id, assignmentType]
    );
    if (slotRes.rows[0]) {
      return NextResponse.json(
        { error: assignmentType === 'OWNER' ? 'La unidad ya tiene propietario activo.' : 'La unidad ya tiene inquilino activo.' },
        { status: 409 }
      );
    }
  }

  const now = new Date().toISOString();
  const userId = `u_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const password = manualPassword ?? generateStaffPassword();

  try {
    const created = await withTransaction(pool, async (db) => {
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const createdUserRes = await db.query<{
        id: string;
        email: string;
        name: string;
        internal_role: string;
        client_id: string | null;
        scope: string;
        status: string;
      }>(
        `INSERT INTO users (id, client_id, email, password_hash, name, role, internal_role, scope, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'client', 'ACTIVE', $8, $8)
         RETURNING id, email, name, internal_role, client_id, scope, status`,
        [userId, targetClientId, email, passwordHash, name, mapInternalRoleToUIRole(internalRole), internalRole, now]
      );

      const createdUser = createdUserRes.rows[0];
      await insertAuditLog(db, {
        clientId: targetClientId as string,
        userId: actor.id,
        action: 'CREATE',
        entity: 'User',
        entityId: createdUser.id,
        metadata: { internalRole },
        newData: createdUser,
      });

      if (internalRole === 'BUILDING_ADMIN' || internalRole === 'STAFF') {
        const assignmentId = `uba_${Date.now()}_${randomUUID().slice(0, 8)}`;
        await db.query(
          `INSERT INTO user_building_assignments (id, client_id, user_id, building_id, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5)`,
          [assignmentId, targetClientId, createdUser.id, resolvedBuildingId, now]
        );
      }

      if (assignmentType) {
        const assignmentId = `uua_${Date.now()}_${randomUUID().slice(0, 8)}`;
        await db.query(
          `INSERT INTO user_unit_assignments (id, client_id, user_id, unit_id, assignment_type, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $6)`,
          [assignmentId, targetClientId, createdUser.id, resolvedUnitId, assignmentType, now]
        );
      }

      return createdUser;
    });

    const res = NextResponse.json({
      user: toUser({ ...created, building_id: resolvedBuildingId, unit_id: resolvedUnitId }),
      tempPassword: password,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code) : '';
    if (code === '23505') return NextResponse.json({ error: 'Ese email ya existe' }, { status: 409 });
    return NextResponse.json({ error: 'No se pudo crear el usuario.' }, { status: 500 });
  }
}


