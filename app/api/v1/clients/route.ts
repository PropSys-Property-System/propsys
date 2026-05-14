import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';

type ClientRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  created_at: string;
};

function normalizeText(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toClient(row: ClientRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(user);
  const rows = await pool.query<ClientRow>(
    bypassTenant
      ? `SELECT id, slug, name, status, created_at::text as created_at
         FROM clients
         WHERE status = 'ACTIVE'
         ORDER BY name ASC`
      : `SELECT id, slug, name, status, created_at::text as created_at
         FROM clients
         WHERE id = $1 AND status = 'ACTIVE'
         ORDER BY name ASC`,
    bypassTenant ? [] : [user.clientId]
  );

  return NextResponse.json({ clients: rows.rows.map(toClient) });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canBypassTenantScope(user)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = normalizeText(body?.name);
  const requestedSlug = normalizeText(body?.slug);
  const slug = slugify(requestedSlug || name);

  if (!name || !slug) {
    return NextResponse.json({ error: 'Nombre de cliente invalido.' }, { status: 400 });
  }

  const pool = getPool();
  const duplicate = await pool.query<{ id: string }>(
    `SELECT id
     FROM clients
     WHERE lower(slug) = lower($1) OR lower(trim(name)) = lower(trim($2))
     LIMIT 1`,
    [slug, name]
  );
  if (duplicate.rows[0]) {
    return NextResponse.json({ error: 'Ya existe un cliente con ese nombre o slug.' }, { status: 409 });
  }

  const id = `client_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    const created = await withTransaction(pool, async (db) => {
      const res = await db.query<ClientRow>(
        `INSERT INTO clients (id, slug, name, status, created_at)
         VALUES ($1, $2, $3, 'ACTIVE', now())
         RETURNING id, slug, name, status, created_at::text as created_at`,
        [id, slug, name]
      );
      const client = res.rows[0];

      await insertAuditLog(db, {
        clientId: client.id,
        userId: user.id,
        action: 'CREATE',
        entity: 'Client',
        entityId: client.id,
        metadata: { source: 'ROOT_ADMIN_ONBOARDING' },
        newData: toClient(client),
      });

      return client;
    });

    return NextResponse.json({ client: toClient(created) });
  } catch {
    return NextResponse.json({ error: 'No pudimos crear el cliente.' }, { status: 500 });
  }
}
