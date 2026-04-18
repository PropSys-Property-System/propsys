import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import type { Receipt } from '@/lib/types';

async function listBuildingIdsForUser(pool: ReturnType<typeof getPool>, user: { id: string; clientId: string | null; scope: string; internalRole: string }) {
  if (canBypassTenantScope(user)) {
    const all = await pool.query<{ id: string }>('SELECT id FROM buildings');
    return all.rows.map((r) => r.id);
  }
  if (!user.clientId) return [];
  if (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER') {
    const all = await pool.query<{ id: string }>('SELECT id FROM buildings WHERE client_id = $1', [user.clientId]);
    return all.rows.map((r) => r.id);
  }
  if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
    const rows = await pool.query<{ building_id: string }>(
      `SELECT building_id
       FROM user_building_assignments
       WHERE user_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [user.id]
    );
    return rows.rows.map((r) => r.building_id);
  }
  return [];
}

async function listUnitIdsForUser(pool: ReturnType<typeof getPool>, user: { id: string; clientId: string | null; scope: string; internalRole: string }) {
  if (!user.clientId) return [];
  if (user.internalRole !== 'OWNER' && user.internalRole !== 'OCCUPANT') return [];
  const rows = await pool.query<{ unit_id: string }>(
    `SELECT unit_id
     FROM user_unit_assignments
     WHERE user_id = $1
       AND status = 'ACTIVE'
       AND deleted_at IS NULL
       AND assignment_type = $2
       AND client_id = $3`,
    [user.id, user.internalRole === 'OWNER' ? 'OWNER' : 'OCCUPANT', user.clientId]
  );
  return rows.rows.map((r) => r.unit_id);
}

function toLegacy(row: {
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

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ receipts: [] });

  const pool = getPool();
  const tenantWhere = bypassTenant ? '' : 'AND client_id = $1';
  const tenantParams = bypassTenant ? [] : [user.clientId];

  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    const unitIds = await listUnitIdsForUser(pool, user);
    if (unitIds.length === 0) return NextResponse.json({ receipts: [] });
    const rows = await pool.query<{
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
       WHERE 1=1
         ${tenantWhere}
         AND unit_id = ANY($${tenantParams.length + 1}::text[])
       ORDER BY due_date DESC, issue_date DESC`,
      [...tenantParams, unitIds]
    );
    return NextResponse.json({ receipts: rows.rows.map(toLegacy) });
  }

  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ receipts: [] });

  const rows = await pool.query<{
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
     WHERE 1=1
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
     ORDER BY due_date DESC, issue_date DESC`,
    [...tenantParams, buildingIds]
  );

  return NextResponse.json({ receipts: rows.rows.map(toLegacy) });
}


