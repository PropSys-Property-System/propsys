import { NextResponse } from 'next/server';
import argon2 from 'argon2';
import { getPool } from '@/lib/server/db/client';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { hashAccountToken, isAccountTokenExpired, verifyAccountToken } from '@/lib/server/auth/account-token';
import { validateStaffPassword as validateAccountPassword } from '@/lib/server/auth/staff-password';
import { withTransaction } from '@/lib/server/db/tx';
import {
  checkRateLimit,
  getClientIp,
  hashRateLimitKey,
  rateLimitExceededHeaders,
} from '@/lib/server/security/rate-limit';

const INVALID_INVITATION_ERROR = 'Invitacion invalida o expirada.';

const INVITATION_ACCEPT_IP_LIMIT = 30;
const INVITATION_ACCEPT_IP_WINDOW_MS = 10 * 60 * 1000; // 10 min

class AcceptInvitationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function normalizeToken(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function normalizePassword(input: unknown): string {
  return typeof input === 'string' ? input : '';
}

function rejectInvalidInvitation(): never {
  throw new AcceptInvitationError(INVALID_INVITATION_ERROR, 400);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = normalizeToken(body?.token);
  const password = normalizePassword(body?.password);

  if (!token || !password) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  if (!validateAccountPassword(password)) {
    return NextResponse.json(
      { error: 'La contrasena debe tener al menos 12 caracteres e incluir mayuscula, minuscula, numero y simbolo.' },
      { status: 400 }
    );
  }

  // Rate limit by IP before touching the DB
  const ip = getClientIp(req);
  const ipKey = hashRateLimitKey('invitation-accept:ip', ip);
  const ipCheck = await checkRateLimit(ipKey, INVITATION_ACCEPT_IP_LIMIT, INVITATION_ACCEPT_IP_WINDOW_MS).catch(() => null);
  if (ipCheck && !ipCheck.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta nuevamente mas tarde.' },
      { status: 429, headers: rateLimitExceededHeaders(ipCheck.retryAfter) }
    );
  }

  const tokenHash = hashAccountToken(token);
  const pool = getPool();
  const now = new Date().toISOString();

  try {
    await withTransaction(pool, async (db) => {
      const invitationRes = await db.query<{
        id: string;
        client_id: string;
        user_id: string;
        email: string;
        token_hash: string;
        status: string;
        expires_at: string;
        accepted_at: string | null;
        revoked_at: string | null;
        user_status: string;
        password_hash: string | null;
      }>(
        `SELECT inv.id, inv.client_id, inv.user_id, inv.email, inv.token_hash, inv.status, inv.expires_at::text as expires_at,
                inv.accepted_at::text as accepted_at, inv.revoked_at::text as revoked_at,
                usr.status as user_status, usr.password_hash
         FROM user_invitations inv
         JOIN users usr ON usr.id = inv.user_id
         WHERE inv.token_hash = $1
         LIMIT 1
         FOR UPDATE OF inv, usr`,
        [tokenHash]
      );
      const invitation = invitationRes.rows[0];
      if (!invitation) rejectInvalidInvitation();

      if (!verifyAccountToken(token, invitation.token_hash)) rejectInvalidInvitation();
      if (invitation.status !== 'PENDING' || invitation.accepted_at || invitation.revoked_at) rejectInvalidInvitation();
      if (isAccountTokenExpired(invitation.expires_at)) rejectInvalidInvitation();
      if (invitation.user_status !== 'INACTIVE' || invitation.password_hash) rejectInvalidInvitation();

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

      await db.query(
        `UPDATE users
         SET password_hash = $2, status = 'ACTIVE', updated_at = $3
         WHERE id = $1`,
        [invitation.user_id, passwordHash, now]
      );

      await db.query(
        `UPDATE user_invitations
         SET status = 'ACCEPTED', accepted_at = $2, updated_at = $2
         WHERE id = $1`,
        [invitation.id, now]
      );

      await insertAuditLog(db, {
        clientId: invitation.client_id,
        userId: invitation.user_id,
        action: 'ACTIVATE',
        entity: 'User',
        entityId: invitation.user_id,
        metadata: { source: 'INVITATION_ACCEPT' },
        newData: { id: invitation.user_id, status: 'ACTIVE' },
      });

      await insertAuditLog(db, {
        clientId: invitation.client_id,
        userId: invitation.user_id,
        action: 'ACCEPT',
        entity: 'UserInvitation',
        entityId: invitation.id,
        metadata: { source: 'INVITATION_ACCEPT' },
        newData: { id: invitation.id, status: 'ACCEPTED', acceptedAt: now },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AcceptInvitationError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'No se pudo aceptar la invitacion.' }, { status: 500 });
  }
}
