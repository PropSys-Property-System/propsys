import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canManageUserLifecycle } from '@/lib/auth/access-rules';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import { mapInternalRoleToUIRole } from '@/lib/auth/role-mapping';
import type { User } from '@/lib/types';

function toUser(row: {
  id: string;
  email: string;
  name: string;
  internal_role: string;
  client_id: string | null;
  scope: string;
  status: string;
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
  };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser(req);
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const nextStatus = body?.status === 'ACTIVE' || body?.status === 'SUSPENDED' ? body.status : null;
  if (!nextStatus) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const pool = getPool();
  const currentRes = await pool.query<{
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
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const current = currentRes.rows[0];
  if (!current) return NextResponse.json({ user: null }, { status: 404 });
  if (actor.id === current.id) return NextResponse.json({ error: 'No puedes cambiar tu propio estado.' }, { status: 400 });
  if (!canManageUserLifecycle(actor, {
    id: current.id,
    internalRole: current.internal_role,
    scope: current.scope,
    clientId: current.client_id,
  })) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (current.status === nextStatus) {
    return NextResponse.json({ user: toUser(current) });
  }

  const now = new Date().toISOString();
  const auditAction = nextStatus === 'SUSPENDED' ? 'DEACTIVATE' : 'RESTORE';

  try {
    const updated = await withTransaction(pool, async (db) => {
      const updatedRes = await db.query<{
        id: string;
        email: string;
        name: string;
        internal_role: string;
        client_id: string | null;
        scope: string;
        status: string;
      }>(
        `UPDATE users
         SET status = $2, updated_at = $3
         WHERE id = $1
         RETURNING id, email, name, internal_role, client_id, scope, status`,
        [id, nextStatus, now]
      );

      if (nextStatus === 'SUSPENDED') {
        await db.query(
          `UPDATE auth_sessions
           SET revoked_at = $2
           WHERE user_id = $1
             AND revoked_at IS NULL
             AND expires_at > now()`,
          [id, now]
        );
      }

      await insertAuditLog(db, {
        clientId: current.client_id as string,
        userId: actor.id,
        action: auditAction,
        entity: 'User',
        entityId: current.id,
        metadata: { fromStatus: current.status, toStatus: nextStatus },
        oldData: current,
        newData: updatedRes.rows[0],
      });

      return updatedRes.rows[0];
    });

    return NextResponse.json({ user: toUser(updated) });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }
}
