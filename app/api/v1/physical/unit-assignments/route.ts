import { NextResponse } from 'next/server';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import { mapInternalRoleToUIRole } from '@/lib/auth/role-mapping';
import type { User } from '@/lib/types';

type AssignmentType = 'OWNER' | 'OCCUPANT';

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function randomPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const special = '!@#$%';
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const middle = Array.from({ length: 8 }, () => pick(alphabet)).join('');
  return `Ps${middle}${pick(special)}`;
}

function toUser(row: {
  id: string;
  email: string;
  name: string;
  internal_role: string;
  client_id: string | null;
  scope: string;
  status: string;
}, unitId: string): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: mapInternalRoleToUIRole(row.internal_role as User['internalRole']),
    internalRole: row.internal_role as User['internalRole'],
    clientId: row.client_id,
    scope: row.scope as User['scope'],
    status: row.status as User['status'],
    unitId,
  };
}

export async function POST(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (actor.internalRole !== 'ROOT_ADMIN' && actor.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const unitId = typeof body?.unitId === 'string' ? body.unitId.trim() : '';
  const assignmentType: AssignmentType | null = body?.assignmentType === 'OWNER' || body?.assignmentType === 'OCCUPANT' ? body.assignmentType : null;
  const ownerAsResident = body?.ownerAsResident === true;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body?.email);

  if (!unitId || !assignmentType || (!ownerAsResident && (!name || !email))) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  const pool = getPool();
  const unitRes = await pool.query<{ id: string; client_id: string; building_id: string; number: string }>(
    `SELECT u.id, u.client_id, u.building_id, u.number
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

  const bypassTenant = canBypassTenantScope(actor);
  if (!bypassTenant && (!actor.clientId || actor.clientId !== unit.client_id)) {
    return NextResponse.json({ error: 'Unidad no encontrada' }, { status: 404 });
  }

  const activeSlotRes = await pool.query<{ id: string }>(
    `SELECT id
     FROM user_unit_assignments
     WHERE unit_id = $1
       AND assignment_type = $2
       AND status = 'ACTIVE'
       AND deleted_at IS NULL
     LIMIT 1`,
    [unitId, assignmentType]
  );
  if (activeSlotRes.rows[0]) {
    return NextResponse.json(
      { error: assignmentType === 'OWNER' ? 'La unidad ya tiene propietario asignado.' : 'La unidad ya tiene inquilino asignado.' },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const assignmentId = `uua_${Date.now()}_${randomUUID().slice(0, 8)}`;

  if (ownerAsResident) {
    if (assignmentType !== 'OCCUPANT') return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

    const ownerRes = await pool.query<{
      id: string;
      email: string;
      name: string;
      internal_role: string;
      client_id: string | null;
      scope: string;
      status: string;
    }>(
      `SELECT usr.id, usr.email, usr.name, usr.internal_role, usr.client_id, usr.scope, usr.status
       FROM user_unit_assignments uua
       JOIN users usr ON usr.id = uua.user_id
       WHERE uua.unit_id = $1
         AND uua.assignment_type = 'OWNER'
         AND uua.status = 'ACTIVE'
         AND uua.deleted_at IS NULL
       LIMIT 1`,
      [unitId]
    );
    const owner = ownerRes.rows[0];
    if (!owner || owner.status !== 'ACTIVE' || owner.internal_role !== 'OWNER' || owner.client_id !== unit.client_id) {
      return NextResponse.json({ error: 'Primero asigna un propietario activo a la unidad.' }, { status: 409 });
    }

    try {
      await withTransaction(pool, async (db) => {
        await db.query(
          `INSERT INTO user_unit_assignments (id, client_id, user_id, unit_id, assignment_type, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'OCCUPANT', 'ACTIVE', $5, $5)`,
          [assignmentId, unit.client_id, owner.id, unitId, now]
        );

        await insertAuditLog(db, {
          clientId: unit.client_id,
          userId: actor.id,
          action: 'ASSIGN',
          entity: 'Unit',
          entityId: unitId,
          metadata: { assignmentType: 'OCCUPANT', assignedUserId: owner.id, ownerAsResident: true },
          newData: { assignmentId, unitId, assignmentType: 'OCCUPANT', userId: owner.id, ownerAsResident: true },
        });
      });

      return NextResponse.json({
        user: toUser(owner, unitId),
        unitId,
        assignmentType: 'OCCUPANT',
        ownerAsResident: true,
      });
    } catch (e: unknown) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code) : '';
      if (code === '23505') return NextResponse.json({ error: 'La unidad ya tiene inquilino asignado.' }, { status: 409 });
      return NextResponse.json({ error: 'No pudimos registrar la asignacion.' }, { status: 500 });
    }
  }

  const internalRole: User['internalRole'] = assignmentType === 'OWNER' ? 'OWNER' : 'OCCUPANT';
  const existingUserRes = await pool.query<{
    id: string;
    email: string;
    name: string;
    internal_role: string;
    client_id: string | null;
    scope: string;
    status: string;
  }>(
    `SELECT id, email, name, internal_role, client_id, scope, status
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email]
  );
  const existingUser = existingUserRes.rows[0];
  if (existingUser && (existingUser.client_id !== unit.client_id || existingUser.internal_role !== internalRole)) {
    return NextResponse.json({ error: 'Ese email ya existe con otro rol o cliente.' }, { status: 409 });
  }
  if (existingUser && existingUser.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Ese usuario existe pero no esta activo; reactivarlo antes de asignarlo.' }, { status: 409 });
  }

  const password = typeof body?.password === 'string' && body.password.trim() ? body.password : randomPassword();
  const userId = existingUser?.id ?? `u_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const tempPassword = existingUser ? undefined : password;

  try {
    const result = await withTransaction(pool, async (db) => {
      let assignedUser = existingUser;

      if (!assignedUser) {
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
          [userId, unit.client_id, email, passwordHash, name, mapInternalRoleToUIRole(internalRole), internalRole, now]
        );
        assignedUser = createdUserRes.rows[0];

        await insertAuditLog(db, {
          clientId: unit.client_id,
          userId: actor.id,
          action: 'CREATE',
          entity: 'User',
          entityId: assignedUser.id,
          metadata: { internalRole, unitId },
          newData: assignedUser,
        });
      }

      await db.query(
        `INSERT INTO user_unit_assignments (id, client_id, user_id, unit_id, assignment_type, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $6)`,
        [assignmentId, unit.client_id, assignedUser.id, unitId, assignmentType, now]
      );

      await insertAuditLog(db, {
        clientId: unit.client_id,
        userId: actor.id,
        action: 'ASSIGN',
        entity: 'Unit',
        entityId: unitId,
        metadata: { assignmentType, assignedUserId: assignedUser.id },
        newData: { assignmentId, unitId, assignmentType, userId: assignedUser.id },
      });

      return assignedUser;
    });

    return NextResponse.json({
      user: toUser(result, unitId),
      unitId,
      assignmentType,
      tempPassword,
    });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code) : '';
    if (code === '23505') return NextResponse.json({ error: 'Ese email ya existe' }, { status: 409 });
    return NextResponse.json({ error: 'No pudimos registrar la asignacion.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (actor.internalRole !== 'ROOT_ADMIN' && actor.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const unitId = typeof body?.unitId === 'string' ? body.unitId.trim() : '';
  if (!unitId) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const pool = getPool();
  const unitRes = await pool.query<{ id: string; client_id: string }>(
    `SELECT u.id, u.client_id
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

  const bypassTenant = canBypassTenantScope(actor);
  if (!bypassTenant && (!actor.clientId || actor.clientId !== unit.client_id)) {
    return NextResponse.json({ error: 'Unidad no encontrada' }, { status: 404 });
  }

  const assignmentRes = await pool.query<{ id: string; user_id: string }>(
    `SELECT id, user_id
     FROM user_unit_assignments
     WHERE unit_id = $1
       AND assignment_type = 'OCCUPANT'
       AND status = 'ACTIVE'
       AND deleted_at IS NULL
     LIMIT 1`,
    [unitId]
  );
  const assignment = assignmentRes.rows[0];
  if (!assignment) return NextResponse.json({ error: 'La unidad no tiene residencia activa.' }, { status: 404 });

  const now = new Date().toISOString();

  try {
    await withTransaction(pool, async (db) => {
      await db.query(
        `UPDATE user_unit_assignments
         SET status = 'ARCHIVED', deleted_at = $2, updated_at = $2
         WHERE id = $1`,
        [assignment.id, now]
      );

      await insertAuditLog(db, {
        clientId: unit.client_id,
        userId: actor.id,
        action: 'UNASSIGN',
        entity: 'Unit',
        entityId: unitId,
        metadata: { assignmentType: 'OCCUPANT', assignedUserId: assignment.user_id },
        oldData: { assignmentId: assignment.id, unitId, assignmentType: 'OCCUPANT', userId: assignment.user_id },
      });
    });

    return NextResponse.json({
      unitId,
      assignmentType: 'OCCUPANT',
      userId: assignment.user_id,
    });
  } catch {
    return NextResponse.json({ error: 'No pudimos liberar la residencia.' }, { status: 500 });
  }
}
