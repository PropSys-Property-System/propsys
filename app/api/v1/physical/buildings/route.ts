import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { Building } from '@/lib/types';

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const url = new URL(req.url);
  const requestedStatus = url.searchParams.get('status') === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ buildings: [] as Building[] });

  const pool = getPool();
  const tenantWhere = bypassTenant ? 'WHERE b.status = $1' : 'WHERE b.client_id = $1 AND b.status = $2';
  const tenantParams = bypassTenant ? [requestedStatus] : [user.clientId, requestedStatus];

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
       WHERE uba.user_id = $1 AND uba.status = 'ACTIVE' AND uba.deleted_at IS NULL AND b.status = 'ACTIVE'
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
         AND b.status = 'ACTIVE'
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

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const bypassTenant = canBypassTenantScope(user);
  if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const rawClientId = typeof body?.clientId === 'string' ? body.clientId.trim() : '';
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const address = typeof body?.address === 'string' ? body.address.trim() : '';
  const city = typeof body?.city === 'string' ? body.city.trim() : '';

  if (!name || !address || !city) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const clientId = bypassTenant ? rawClientId : user.clientId;
  if (!clientId) {
    return NextResponse.json({ error: 'Selecciona un cliente para crear el edificio.' }, { status: 400 });
  }

  const pool = getPool();
  const clientRes = await pool.query<{ id: string }>('SELECT id FROM clients WHERE id = $1 LIMIT 1', [clientId]);
  if (!clientRes.rows[0]) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  }

  if (!bypassTenant && user.clientId !== clientId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const duplicateRes = await pool.query<{ id: string }>(
    "SELECT id FROM buildings WHERE client_id = $1 AND status = 'ACTIVE' AND lower(trim(name)) = lower(trim($2)) LIMIT 1",
    [clientId, name]
  );
  if (duplicateRes.rows[0]) {
    return NextResponse.json({ error: 'Ya existe un edificio con ese nombre para este cliente.' }, { status: 409 });
  }

  const id = `b_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  try {
    const row = await withTransaction(pool, async (db) => {
      const created = await db.query<{
        id: string;
        client_id: string;
        name: string;
        address: string | null;
        city: string | null;
      }>(
        `INSERT INTO buildings (id, client_id, name, address, city, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', $6, $6)
         RETURNING id, client_id, name, address, city`,
        [id, clientId, name, address, city, now]
      );

      await insertAuditLog(db, {
        clientId,
        userId: user.id,
        action: 'CREATE',
        entity: 'Building',
        entityId: id,
        metadata: { address, city },
        newData: created.rows[0],
      });

      return created.rows[0];
    });

    const building: Building = {
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      address: row.address ?? '',
      city: row.city ?? '',
    };

    return NextResponse.json({ building });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}


