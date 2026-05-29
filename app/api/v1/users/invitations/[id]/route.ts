import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { addAccountTokenExpiry, generateAccountToken, hashAccountToken } from '@/lib/server/auth/account-token';
import { buildCanonicalAppUrl } from '@/lib/server/app-url';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function buildInviteLink(token: string): string {
  return buildCanonicalAppUrl('/invitations/accept', { token });
}

function noStore(res: Response): Response {
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser(req);
  if (!actor) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (actor.internalRole !== 'ROOT_ADMIN' && actor.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const action = body?.action;

  if (action !== 'REVOKE' && action !== 'REISSUE') {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  }

  const pool = getPool();

  const invRes = await pool.query<{
    id: string;
    client_id: string;
    user_id: string;
    status: string;
    email: string;
  }>(
    `SELECT id, client_id, user_id, status, email 
     FROM user_invitations 
     WHERE id = $1 LIMIT 1`,
    [id]
  );
  
  const invitation = invRes.rows[0];
  if (!invitation) return noStore(NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 }));

  if (actor.internalRole === 'CLIENT_MANAGER' && invitation.client_id !== actor.clientId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (invitation.status !== 'PENDING') {
    return NextResponse.json({ error: 'Solo se pueden modificar invitaciones PENDING' }, { status: 400 });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  if (action === 'REVOKE') {
    await pool.query(
      `UPDATE user_invitations 
       SET status = 'REVOKED', revoked_at = $1, updated_at = $1 
       WHERE id = $2`,
      [nowIso, id]
    );

    await insertAuditLog(pool, {
      clientId: invitation.client_id,
      userId: actor.id,
      action: 'REVOKE_INVITATION',
      entity: 'UserInvitation',
      entityId: id,
      metadata: { targetUserId: invitation.user_id }
    });

    return noStore(NextResponse.json({ ok: true, status: 'REVOKED' }));
  }

  if (action === 'REISSUE') {
    const rawToken = generateAccountToken();
    const tokenHash = hashAccountToken(rawToken);
    const expiresAt = addAccountTokenExpiry(now, INVITATION_TTL_MS).toISOString();

    await pool.query(
      `UPDATE user_invitations 
       SET token_hash = $1, expires_at = $2, updated_at = $3 
       WHERE id = $4`,
      [tokenHash, expiresAt, nowIso, id]
    );

    await insertAuditLog(pool, {
      clientId: invitation.client_id,
      userId: actor.id,
      action: 'REISSUE_INVITATION',
      entity: 'UserInvitation',
      entityId: id,
      metadata: { targetUserId: invitation.user_id, expiresAt }
    });

    const inviteLink = buildInviteLink(rawToken);

    return noStore(NextResponse.json({
      ok: true,
      status: 'PENDING',
      delivery: {
        mode: 'manual_link',
        inviteLink
      }
    }));
  }

  return NextResponse.json({ error: 'Unreachable' }, { status: 500 });
}
