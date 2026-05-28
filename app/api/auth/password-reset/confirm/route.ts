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

const INVALID_RESET_ERROR = 'Reset invalido o expirado.';

const RESET_CONFIRM_IP_LIMIT = 30;
const RESET_CONFIRM_IP_WINDOW_MS = 10 * 60 * 1000; // 10 min

class ConfirmResetError extends Error {
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

function rejectInvalidReset(): never {
  throw new ConfirmResetError(INVALID_RESET_ERROR, 400);
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
      { error: 'La contraseña debe tener al menos 12 caracteres e incluir mayuscula, minuscula, numero y simbolo.' },
      { status: 400 }
    );
  }

  // Rate limit by IP before touching the DB
  const ip = getClientIp(req);
  const ipKey = hashRateLimitKey('reset-confirm:ip', ip);
  const ipCheck = await checkRateLimit(ipKey, RESET_CONFIRM_IP_LIMIT, RESET_CONFIRM_IP_WINDOW_MS).catch(() => null);
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
      const tokenRes = await db.query<{
        id: string;
        client_id: string | null;
        user_id: string;
        email: string;
        token_hash: string;
        expires_at: string;
        used_at: string | null;
        revoked_at: string | null;
        user_status: string;
      }>(
        `SELECT prt.id, prt.client_id, prt.user_id, prt.email, prt.token_hash, prt.expires_at::text as expires_at,
                prt.used_at::text as used_at, prt.revoked_at::text as revoked_at,
                usr.status as user_status
         FROM password_reset_tokens prt
         JOIN users usr ON usr.id = prt.user_id
         WHERE prt.token_hash = $1
         LIMIT 1
         FOR UPDATE OF prt, usr`,
        [tokenHash]
      );
      const resetToken = tokenRes.rows[0];
      if (!resetToken) rejectInvalidReset();

      if (!verifyAccountToken(token, resetToken.token_hash)) rejectInvalidReset();
      if (resetToken.used_at || resetToken.revoked_at) rejectInvalidReset();
      if (isAccountTokenExpired(resetToken.expires_at)) rejectInvalidReset();
      if (resetToken.user_status !== 'ACTIVE') rejectInvalidReset();

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

      await db.query(
        `UPDATE users
         SET password_hash = $2, updated_at = $3
         WHERE id = $1`,
        [resetToken.user_id, passwordHash, now]
      );

      await db.query(
        `UPDATE password_reset_tokens
         SET used_at = $2
         WHERE id = $1`,
        [resetToken.id, now]
      );

      if (resetToken.client_id) {
        await insertAuditLog(db, {
          clientId: resetToken.client_id,
          userId: resetToken.user_id,
          action: 'RESET_PASSWORD',
          entity: 'User',
          entityId: resetToken.user_id,
          metadata: { source: 'PASSWORD_RESET_CONFIRM' },
          newData: { id: resetToken.user_id },
        });

        await insertAuditLog(db, {
          clientId: resetToken.client_id,
          userId: resetToken.user_id,
          action: 'USE',
          entity: 'PasswordResetToken',
          entityId: resetToken.id,
          metadata: { source: 'PASSWORD_RESET_CONFIRM' },
          newData: { id: resetToken.id, usedAt: now },
        });
      }
    });

    const res = NextResponse.json({ ok: true });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e) {
    if (e instanceof ConfirmResetError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'No se pudo confirmar la recuperacion de contraseña.' }, { status: 500 });
  }
}
