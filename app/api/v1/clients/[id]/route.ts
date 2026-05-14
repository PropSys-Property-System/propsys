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

function toClient(row: ClientRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!canBypassTenantScope(user)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID de cliente invalido.' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const name = body?.name !== undefined ? normalizeText(body.name) : undefined;
  const status = body?.status;

  if (name !== undefined && !name) {
    return NextResponse.json({ error: 'El nombre del cliente no puede estar vacio.' }, { status: 400 });
  }
  if (status !== undefined && status !== 'ACTIVE' && status !== 'SUSPENDED') {
    return NextResponse.json({ error: 'Estado invalido.' }, { status: 400 });
  }
  if (name === undefined && status === undefined) {
    return NextResponse.json({ error: 'No hay campos para actualizar.' }, { status: 400 });
  }

  const pool = getPool();
  
  // Verificamos existencia y duplicidad de nombre si corresponde
  const existing = await pool.query<ClientRow>('SELECT * FROM clients WHERE id = $1 LIMIT 1', [id]);
  if (!existing.rows[0]) {
    return NextResponse.json({ error: 'Cliente no encontrado.' }, { status: 404 });
  }
  
  if (name !== undefined && name !== existing.rows[0].name) {
    const duplicate = await pool.query<{ id: string }>(
      `SELECT id FROM clients WHERE lower(trim(name)) = lower(trim($1)) AND id != $2 LIMIT 1`,
      [name, id]
    );
    if (duplicate.rows[0]) {
      return NextResponse.json({ error: 'Ya existe otro cliente con ese nombre.' }, { status: 409 });
    }
  }

  try {
    const updated = await withTransaction(pool, async (db) => {
      const updates: string[] = [];
      const values: (string | undefined)[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(status);
      }

      values.push(id);
      const query = `
        UPDATE clients 
        SET ${updates.join(', ')} 
        WHERE id = $${paramCount} 
        RETURNING id, slug, name, status, created_at::text as created_at
      `;

      const res = await db.query<ClientRow>(query, values);
      const client = res.rows[0];

      await insertAuditLog(db, {
        clientId: client.id,
        userId: user.id,
        action: 'UPDATE',
        entity: 'Client',
        entityId: client.id,
        metadata: { source: 'ROOT_ADMIN_MANAGEMENT', changes: { name, status } },
        newData: toClient(client),
      });

      return client;
    });

    return NextResponse.json({ client: toClient(updated) });
  } catch {
    return NextResponse.json({ error: 'No pudimos actualizar el cliente.' }, { status: 500 });
  }
}
