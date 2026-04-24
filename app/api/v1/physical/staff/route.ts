import { NextResponse } from 'next/server';
import argon2 from 'argon2';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import type { StaffMember } from '@/lib/types';
import { randomUUID } from 'node:crypto';
import { withTransaction } from '@/lib/server/db/tx';

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
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

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
  } else if (!bypassTenant) {
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
       ${bypassTenant ? '' : 'AND uba.client_id = $2 AND u.client_id = $2'}
     ORDER BY u.internal_role ASC, u.name ASC`,
    bypassTenant ? [buildingId] : [buildingId, user.clientId]
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

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT' || user.internalRole === 'STAFF') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const buildingId = typeof body?.buildingId === 'string' ? body.buildingId : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' && body.password.trim() ? body.password : randomPassword();

  if (!buildingId || !name || !email) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const buildingRes = await pool.query<{ client_id: string }>('SELECT client_id FROM buildings WHERE id = $1 LIMIT 1', [buildingId]);
  const building = buildingRes.rows[0];
  if (!building) return NextResponse.json({ error: 'Edificio no encontrado' }, { status: 404 });

  if (user.internalRole === 'BUILDING_ADMIN') {
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
  } else if (!bypassTenant) {
    if (building.client_id !== user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const userId = `u_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const assignmentId = `uba_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await withTransaction(pool, async (db) => {
      await db.query(
        `INSERT INTO users (id, client_id, email, password_hash, name, role, internal_role, scope, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'STAFF', 'STAFF', 'client', 'ACTIVE', $6, $6)`,
        [userId, building.client_id, email, passwordHash, name, now]
      );

      await db.query(
        `INSERT INTO user_building_assignments (id, client_id, user_id, building_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $5)`,
        [assignmentId, building.client_id, userId, buildingId, now]
      );
    });

    const staff: StaffMember = {
      id: userId,
      buildingId,
      name,
      role: roleLabel('STAFF'),
      status: 'ACTIVE',
    };

    return NextResponse.json({ staff, tempPassword: password });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code) : '';
    if (code === '23505') {
      return NextResponse.json({ error: 'Ese email ya existe' }, { status: 409 });
    }
    return NextResponse.json({ error: 'No se pudo crear el staff' }, { status: 500 });
  }
}
