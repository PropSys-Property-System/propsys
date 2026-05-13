import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser, type SessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { mapInternalRoleToUIRole } from '@/lib/auth/role-mapping';
import { withTransaction } from '@/lib/server/db/tx';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { addAccountTokenExpiry, generateAccountToken, hashAccountToken } from '@/lib/server/auth/account-token';
import { isEmailProviderConfigured, sendInvitationEmail, shouldExposeEmailDebugLinks } from '@/lib/server/email/resend';
import { buildCanonicalAppUrl } from '@/lib/server/app-url';
import type { InternalRole, UserInvitationStatus } from '@/lib/types/auth';
import type { User } from '@/lib/types';

const INVITABLE_INTERNAL_ROLES = ['BUILDING_ADMIN', 'STAFF', 'OWNER', 'OCCUPANT'] as const;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type InvitableInternalRole = (typeof INVITABLE_INTERNAL_ROLES)[number];
type AssignmentType = 'OWNER' | 'OCCUPANT';

function normalizeText(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function normalizeEmail(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
}

function parseInvitableRole(input: unknown): InvitableInternalRole | null {
  return INVITABLE_INTERNAL_ROLES.find((role) => role === input) ?? null;
}

function deliveryMode(): 'resend' {
  return 'resend';
}

function buildInviteLink(token: string): string {
  return buildCanonicalAppUrl('/invitations/accept', { token });
}

function canInviteRole(actor: SessionUser, internalRole: InvitableInternalRole): boolean {
  if (actor.internalRole === 'ROOT_ADMIN') return true;
  if (actor.internalRole === 'CLIENT_MANAGER') return true;
  if (actor.internalRole === 'BUILDING_ADMIN') return internalRole === 'STAFF';
  return false;
}

function canAccessClient(actor: SessionUser, clientId: string): boolean {
  if (canBypassTenantScope(actor)) return true;
  return Boolean(actor.clientId) && actor.clientId === clientId;
}

function toUser(row: {
  id: string;
  email: string;
  name: string;
  internal_role: string;
  client_id: string | null;
  scope: string;
  status: string;
}, context: { buildingId?: string | null; unitId?: string | null }): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: mapInternalRoleToUIRole(row.internal_role as InternalRole),
    internalRole: row.internal_role as User['internalRole'],
    clientId: row.client_id,
    scope: row.scope as User['scope'],
    status: row.status as User['status'],
    buildingId: context.buildingId ?? undefined,
    unitId: context.unitId ?? undefined,
  };
}

export async function POST(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const name = normalizeText(body?.name);
  const internalRole = parseInvitableRole(body?.internalRole);
  const buildingId = normalizeText(body?.buildingId) || null;
  const unitId = normalizeText(body?.unitId) || null;

  if (!email || !name || !internalRole) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  if (!canInviteRole(actor, internalRole)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if ((internalRole === 'BUILDING_ADMIN' || internalRole === 'STAFF') && !buildingId) {
    return NextResponse.json({ error: 'Selecciona un edificio para ese rol.' }, { status: 400 });
  }

  if ((internalRole === 'OWNER' || internalRole === 'OCCUPANT') && !unitId) {
    return NextResponse.json({ error: 'Selecciona una unidad para ese rol.' }, { status: 400 });
  }

  if (!isEmailProviderConfigured()) {
    return NextResponse.json(
      { error: 'No hay proveedor de correo configurado para enviar invitaciones. Reemplaza re_xxxxxxxxx por tu API key real de Resend.' },
      { status: 503 }
    );
  }

  const pool = getPool();
  let targetClientId: string;
  let resolvedBuildingId = buildingId;
  let resolvedUnitId = unitId;
  let assignmentType: AssignmentType | null = null;

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
    if (!canAccessClient(actor, building.client_id)) return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });

    if (actor.internalRole === 'BUILDING_ADMIN') {
      const assignmentRes = await pool.query<{ ok: boolean }>(
        `SELECT true as ok
         FROM user_building_assignments
         WHERE user_id = $1
           AND building_id = $2
           AND status = 'ACTIVE'
           AND deleted_at IS NULL
         LIMIT 1`,
        [actor.id, building.id]
      );
      if (!assignmentRes.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    targetClientId = building.client_id;
    resolvedBuildingId = building.id;
  } else {
    assignmentType = internalRole === 'OWNER' ? 'OWNER' : 'OCCUPANT';
    const unitRes = await pool.query<{ id: string; client_id: string; building_id: string }>(
      `SELECT u.id, u.client_id, u.building_id
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
    if (!canAccessClient(actor, unit.client_id)) return NextResponse.json({ error: 'Unidad no encontrada' }, { status: 404 });

    const activeSlotRes = await pool.query<{ id: string }>(
      `SELECT id
       FROM user_unit_assignments
       WHERE unit_id = $1
         AND assignment_type = $2
         AND status = 'ACTIVE'
         AND deleted_at IS NULL
       LIMIT 1`,
      [unit.id, assignmentType]
    );
    if (activeSlotRes.rows[0]) {
      return NextResponse.json(
        { error: assignmentType === 'OWNER' ? 'La unidad ya tiene propietario activo.' : 'La unidad ya tiene inquilino activo.' },
        { status: 409 }
      );
    }

    targetClientId = unit.client_id;
    resolvedBuildingId = unit.building_id;
    resolvedUnitId = unit.id;
  }

  const existingUserRes = await pool.query<{ id: string }>(
    `SELECT id
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email]
  );
  if (existingUserRes.rows[0]) {
    return NextResponse.json({ error: 'Ese email ya existe; revisa si corresponde reactivar o reutilizar el usuario.' }, { status: 409 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = addAccountTokenExpiry(now, INVITATION_TTL_MS).toISOString();
  const rawToken = generateAccountToken();
  const tokenHash = hashAccountToken(rawToken);
  const userId = `u_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const invitationId = `inv_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const assignmentId = `${assignmentType ? 'uua' : 'uba'}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const invitationStatus: UserInvitationStatus = 'PENDING';

  try {
    const created = await withTransaction(pool, async (db) => {
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
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'client', 'INACTIVE', $8, $8)
         RETURNING id, email, name, internal_role, client_id, scope, status`,
        [userId, targetClientId, email, null, name, mapInternalRoleToUIRole(internalRole), internalRole, nowIso]
      );
      const createdUser = createdUserRes.rows[0];

      await insertAuditLog(db, {
        clientId: targetClientId,
        userId: actor.id,
        action: 'CREATE',
        entity: 'User',
        entityId: createdUser.id,
        metadata: { internalRole, source: 'INVITATION' },
        newData: createdUser,
      });

      if (assignmentType) {
        await db.query(
          `INSERT INTO user_unit_assignments (id, client_id, user_id, unit_id, assignment_type, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $6)`,
          [assignmentId, targetClientId, createdUser.id, resolvedUnitId, assignmentType, nowIso]
        );

        await insertAuditLog(db, {
          clientId: targetClientId,
          userId: actor.id,
          action: 'ASSIGN',
          entity: 'Unit',
          entityId: resolvedUnitId as string,
          metadata: { assignmentType, assignedUserId: createdUser.id, source: 'INVITATION' },
          newData: { assignmentId, unitId: resolvedUnitId, assignmentType, userId: createdUser.id },
        });
      } else {
        await db.query(
          `INSERT INTO user_building_assignments (id, client_id, user_id, building_id, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5)`,
          [assignmentId, targetClientId, createdUser.id, resolvedBuildingId, nowIso]
        );

        await insertAuditLog(db, {
          clientId: targetClientId,
          userId: actor.id,
          action: 'ASSIGN',
          entity: 'Building',
          entityId: resolvedBuildingId as string,
          metadata: { internalRole, assignedUserId: createdUser.id, source: 'INVITATION' },
          newData: { assignmentId, buildingId: resolvedBuildingId, userId: createdUser.id },
        });
      }

      await db.query(
        `INSERT INTO user_invitations (id, client_id, user_id, invited_by_user_id, email, token_hash, status, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
        [invitationId, targetClientId, createdUser.id, actor.id, email, tokenHash, invitationStatus, expiresAt, nowIso]
      );

      await insertAuditLog(db, {
        clientId: targetClientId,
        userId: actor.id,
        action: 'CREATE',
        entity: 'UserInvitation',
        entityId: invitationId,
        metadata: { internalRole, deliveryMode: deliveryMode(), expiresAt, buildingId: resolvedBuildingId, unitId: resolvedUnitId },
        newData: { id: invitationId, userId: createdUser.id, email, status: invitationStatus, expiresAt },
      });

      return createdUser;
    });

    const inviteLink = buildInviteLink(rawToken);
    await sendInvitationEmail({
      to: email,
      name,
      inviteLink,
      internalRole,
      expiresAt,
    });

    const delivery = shouldExposeEmailDebugLinks()
      ? {
          mode: deliveryMode(),
          inviteLink,
        }
      : {
          mode: deliveryMode(),
        };

    const res = NextResponse.json({
      user: toUser(created, { buildingId: resolvedBuildingId, unitId: resolvedUnitId }),
      invitation: {
        id: invitationId,
        status: invitationStatus,
        expiresAt,
      },
      delivery,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code) : '';
    if (code === '23505') return NextResponse.json({ error: 'Ese email ya existe' }, { status: 409 });
    return NextResponse.json({ error: 'No se pudo crear la invitacion.' }, { status: 500 });
  }
}
