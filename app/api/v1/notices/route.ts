import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import type { Notice, NoticeEntity } from '@/lib/types';

function toLegacyNotice(n: NoticeEntity): Notice {
  return {
    id: n.id,
    clientId: n.clientId,
    audience: n.audience,
    buildingId: n.buildingId,
    title: n.title,
    body: n.body,
    createdAt: n.publishedAt ?? n.createdAt,
  };
}

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
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    const rows = await pool.query<{ building_id: string }>(
      `SELECT DISTINCT u.building_id
       FROM user_unit_assignments uua
       JOIN units u ON u.id = uua.unit_id
       WHERE uua.user_id = $1 AND uua.status = 'ACTIVE' AND uua.deleted_at IS NULL
         ${user.internalRole === 'OWNER' ? "AND uua.assignment_type = 'OWNER'" : "AND uua.assignment_type = 'OCCUPANT'"}
         AND u.client_id = $2`,
      [user.id, user.clientId]
    );
    return rows.rows.map((r) => r.building_id);
  }
  return [];
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ notices: [] as Notice[] });
  const tenantWhere = bypassTenant ? '' : 'AND client_id = $1';
  const tenantParams = bypassTenant ? [] : [user.clientId];
  const buildingIds = await listBuildingIdsForUser(pool, user);

  const allRows = await pool.query<{
    id: string;
    client_id: string;
    audience: string;
    building_id: string | null;
    title: string;
    body: string;
    status: string;
    created_by_user_id: string;
    created_at: string;
    updated_at: string;
    published_at: string | null;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, audience, building_id, title, body, status, created_by_user_id, created_at, updated_at, published_at, deleted_at
     FROM notices
     WHERE status = 'PUBLISHED'
       AND deleted_at IS NULL
       ${tenantWhere}
     ORDER BY published_at DESC NULLS LAST, created_at DESC`,
    tenantParams
  );

  const entities: NoticeEntity[] = allRows.rows.map((n) => ({
    id: n.id,
    clientId: n.client_id,
    audience: n.audience as NoticeEntity['audience'],
    buildingId: n.building_id ?? undefined,
    title: n.title,
    body: n.body,
    status: n.status as NoticeEntity['status'],
    createdByUserId: n.created_by_user_id,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
    publishedAt: n.published_at ?? undefined,
    deletedAt: n.deleted_at,
  }));

  const visible = entities.filter((n) => {
    if (n.audience === 'ALL_BUILDINGS') return true;
    if (!n.buildingId) return false;
    return buildingIds.includes(n.buildingId);
  });

  return NextResponse.json({ notices: visible.map(toLegacyNotice) });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (user.internalRole === 'STAFF' || user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const audience = body?.audience === 'BUILDING' || body?.audience === 'ALL_BUILDINGS' ? body.audience : null;
  const buildingId = typeof body?.buildingId === 'string' ? body.buildingId : null;
  const requestedClientId = typeof body?.clientId === 'string' ? body.clientId : null;
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const bodyText = typeof body?.body === 'string' ? body.body.trim() : '';

  if (!audience || !title || !bodyText) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const pool = getPool();
  const now = new Date().toISOString();
  if (!bypassTenant && requestedClientId && requestedClientId !== user.clientId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  let clientId: string;
  if (bypassTenant) {
    if (!requestedClientId) {
      return NextResponse.json({ error: 'Selecciona un cliente para publicar el aviso.' }, { status: 400 });
    }
    const okClient = await pool.query<{ id: string }>('SELECT id FROM clients WHERE id = $1 AND status = $2 LIMIT 1', [
      requestedClientId,
      'ACTIVE',
    ]);
    if (!okClient.rows[0]) {
      return NextResponse.json({ error: 'Cliente inválido.' }, { status: 400 });
    }
    clientId = requestedClientId;
  } else {
    clientId = user.clientId!;
  }

  if (audience === 'ALL_BUILDINGS' && user.internalRole === 'BUILDING_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (audience === 'BUILDING') {
    if (!buildingId) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    const building = await pool.query<{ client_id: string }>('SELECT client_id FROM buildings WHERE id = $1 LIMIT 1', [buildingId]);
    if (!building.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (building.rows[0].client_id !== clientId) {
      return NextResponse.json({ error: 'El edificio no pertenece al cliente seleccionado.' }, { status: 400 });
    }

    if (user.internalRole === 'BUILDING_ADMIN') {
      const ok = await pool.query<{ ok: boolean }>(
        `SELECT true as ok FROM user_building_assignments
         WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
         LIMIT 1`,
        [user.id, buildingId]
      );
      if (!ok.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  }

  const id = `notice_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const entity: NoticeEntity = {
    id,
    clientId,
    audience,
    buildingId: audience === 'BUILDING' ? (buildingId ?? undefined) : undefined,
    title,
    body: bodyText,
    status: 'PUBLISHED',
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };

  try {
    await withTransaction(pool, async (db) => {
      await db.query(
        `INSERT INTO notices (id, client_id, audience, building_id, title, body, status, created_by_user_id, created_at, updated_at, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'PUBLISHED', $7, $8, $8, $8)`,
        [id, clientId, audience, audience === 'BUILDING' ? buildingId : null, title, bodyText, user.id, now]
      );
      await insertAuditLog(db, {
        clientId,
        userId: user.id,
        action: 'CREATE',
        entity: 'Notice',
        entityId: id,
        metadata: { audience, buildingId: entity.buildingId ?? null },
        newData: entity,
      });
    });
    return NextResponse.json({ notice: entity });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
