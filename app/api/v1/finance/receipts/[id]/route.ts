import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canAccessTenantEntity, canBypassTenantScope, hasTenantClientContext } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { Receipt } from '@/lib/types';

async function hasBuildingAssignment(pool: ReturnType<typeof getPool>, userId: string, buildingId: string) {
  const ok = await pool.query<{ ok: boolean }>(
    `SELECT true as ok
     FROM user_building_assignments
     WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
     LIMIT 1`,
    [userId, buildingId]
  );
  return !!ok.rows[0];
}

async function hasUnitAssignment(pool: ReturnType<typeof getPool>, user: { id: string; clientId: string | null; internalRole: string }, unitId: string) {
  if (!user.clientId) return false;
  if (user.internalRole !== 'OWNER' && user.internalRole !== 'OCCUPANT') return false;
  const ok = await pool.query<{ ok: boolean }>(
    `SELECT true as ok
     FROM user_unit_assignments
     WHERE user_id = $1
       AND unit_id = $2
       AND assignment_type = $3
       AND status = 'ACTIVE'
       AND deleted_at IS NULL
       AND client_id = $4
     LIMIT 1`,
    [user.id, unitId, user.internalRole === 'OWNER' ? 'OWNER' : 'OCCUPANT', user.clientId]
  );
  return !!ok.rows[0];
}

function toLegacy(row: {
  id: string;
  building_id: string;
  unit_id: string;
  number: string;
  description: string | null;
  amount: string;
  currency: string;
  issue_date: string;
  due_date: string;
  status: string;
}): Receipt {
  return {
    id: row.id,
    buildingId: row.building_id,
    unitId: row.unit_id,
    number: row.number,
    description: row.description ?? '',
    amount: Number(row.amount),
    currency: row.currency,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status as Receipt['status'],
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  const pool = getPool();

  const rowRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    unit_id: string;
    number: string;
    description: string | null;
    amount: string;
    currency: string;
    issue_date: string;
    due_date: string;
    status: string;
  }>(
    `SELECT id, client_id, building_id, unit_id, number, description, amount::text as amount, currency, issue_date::text as issue_date, due_date::text as due_date, status
     FROM receipts
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const row = rowRes.rows[0];
  if (!row) return NextResponse.json({ receipt: null }, { status: 404 });

  if (!canAccessTenantEntity(user, row.client_id)) {
    return NextResponse.json({ receipt: null }, { status: 404 });
  }

  if (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER') {
    return NextResponse.json({ receipt: toLegacy(row) });
  }

  if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
    const ok = await hasBuildingAssignment(pool, user.id, row.building_id);
    if (!ok) return NextResponse.json({ receipt: null }, { status: 404 });
    return NextResponse.json({ receipt: toLegacy(row) });
  }

  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    const ok = await hasUnitAssignment(pool, user, row.unit_id);
    if (!ok) return NextResponse.json({ receipt: null }, { status: 404 });
    return NextResponse.json({ receipt: toLegacy(row) });
  }

  return NextResponse.json({ receipt: null }, { status: 404 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (user.internalRole === 'STAFF' || user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const bypassTenant = canBypassTenantScope(user);
  if (!hasTenantClientContext(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const nextStatus = typeof body?.status === 'string' ? body.status : null;

  if (nextStatus !== 'PAID' && nextStatus !== 'CANCELLED') {
    return NextResponse.json({ error: 'Transición de estado no permitida' }, { status: 400 });
  }

  const pool = getPool();
  const currentRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    unit_id: string;
    number: string;
    description: string | null;
    amount: string;
    currency: string;
    issue_date: string;
    due_date: string;
    status: string;
  }>(
    `SELECT id, client_id, building_id, unit_id, number, description, amount::text as amount, currency, issue_date::text as issue_date, due_date::text as due_date, status
     FROM receipts
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  
  const current = currentRes.rows[0];
  if (!current) {
    return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
  }

  if (!bypassTenant && current.client_id !== user.clientId) {
    return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
  }

  if (user.internalRole === 'BUILDING_ADMIN') {
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok FROM user_building_assignments
       WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
       LIMIT 1`,
      [user.id, current.building_id]
    );
    if (!ok.rows[0]) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
  }

  if (current.status !== 'PENDING') {
    return NextResponse.json({ error: `No se puede modificar un recibo que está ${current.status}` }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    const updated = await withTransaction(pool, async (db) => {
      const res = await db.query<{
        id: string;
        client_id: string;
        building_id: string;
        unit_id: string;
        number: string;
        description: string | null;
        amount: string;
        currency: string;
        issue_date: string;
        due_date: string;
        status: string;
      }>(
        `UPDATE receipts
         SET status = $2, updated_at = $3
         WHERE id = $1
         RETURNING id, client_id, building_id, unit_id, number, description, amount::text as amount, currency, issue_date::text as issue_date, due_date::text as due_date, status`,
        [id, nextStatus, now]
      );
      const updatedRow = res.rows[0];

      await insertAuditLog(db, {
        clientId: current.client_id,
        userId: user.id,
        action: nextStatus === 'PAID' ? 'MARK_PAID' : 'CANCEL',
        entity: 'Receipt',
        entityId: id,
        metadata: { status: nextStatus },
        oldData: toLegacy(current),
        newData: toLegacy(updatedRow),
      });

      return updatedRow;
    });

    return NextResponse.json({ receipt: toLegacy(updated) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
