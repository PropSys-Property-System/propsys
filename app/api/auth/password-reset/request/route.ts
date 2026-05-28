import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { addAccountTokenExpiry, generateAccountToken, hashAccountToken } from '@/lib/server/auth/account-token';
import { withTransaction } from '@/lib/server/db/tx';
import { isEmailProviderConfigured, sendPasswordResetEmail, shouldExposeEmailDebugLinks } from '@/lib/server/email/resend';
import { buildCanonicalAppUrl } from '@/lib/server/app-url';
import {
  checkRateLimit,
  getClientIp,
  hashRateLimitKey,
} from '@/lib/server/security/rate-limit';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

// Rate limit config: request is the most abuse-prone endpoint
const RESET_REQUEST_EMAIL_LIMIT = 3;
const RESET_REQUEST_EMAIL_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RESET_REQUEST_IP_LIMIT = 20;
const RESET_REQUEST_IP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function normalizeEmail(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
}

function deliveryMode(): 'resend' {
  return 'resend';
}

function buildResetLink(token: string): string {
  return buildCanonicalAppUrl('/reset-password', { token });
}

function genericResponse() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = normalizeEmail(body?.email);

  if (!email) {
    return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });
  }

  // Rate limit by IP first, then by email
  const ip = getClientIp(req);
  const ipKey = hashRateLimitKey('reset-request:ip', ip);
  const emailKey = hashRateLimitKey('reset-request:email', email);

  const ipCheck = await checkRateLimit(ipKey, RESET_REQUEST_IP_LIMIT, RESET_REQUEST_IP_WINDOW_MS).catch(() => null);
  if (ipCheck && !ipCheck.allowed) {
    // Return generic to avoid confirming the endpoint behavior to attackers
    return genericResponse();
  }

  const emailCheck = await checkRateLimit(emailKey, RESET_REQUEST_EMAIL_LIMIT, RESET_REQUEST_EMAIL_WINDOW_MS).catch(() => null);
  if (emailCheck && !emailCheck.allowed) {
    // Generic response: don't tell the attacker email is rate-limited
    return genericResponse();
  }

  if (!isEmailProviderConfigured()) {
    const res = NextResponse.json(
      { error: 'No hay proveedor de correo configurado para enviar recuperacion de contraseña. Reemplaza re_xxxxxxxxx por tu API key real de Resend.' },
      { status: 503 }
    );
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const pool = getPool();
  const userRes = await pool.query<{
    id: string;
    client_id: string | null;
    email: string;
    status: string;
    password_hash: string | null;
  }>(
    `SELECT id, client_id, email, status, password_hash
     FROM users
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email]
  );
  const user = userRes.rows[0];

  if (!user || user.status !== 'ACTIVE' || !user.password_hash) {
    return genericResponse();
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = addAccountTokenExpiry(now, PASSWORD_RESET_TTL_MS).toISOString();
  const rawToken = generateAccountToken();
  const tokenHash = hashAccountToken(rawToken);
  const tokenId = `prt_${Date.now()}_${randomUUID().slice(0, 8)}`;

  try {
    await withTransaction(pool, async (db) => {
      await db.query(
        `UPDATE password_reset_tokens
         SET revoked_at = $2
         WHERE user_id = $1
           AND used_at IS NULL
           AND revoked_at IS NULL`,
        [user.id, nowIso]
      );

      await db.query(
        `INSERT INTO password_reset_tokens (id, client_id, user_id, email, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tokenId, user.client_id, user.id, user.email, tokenHash, expiresAt, nowIso]
      );

      if (user.client_id) {
        await insertAuditLog(db, {
          clientId: user.client_id,
          userId: user.id,
          action: 'REQUEST',
          entity: 'PasswordResetToken',
          entityId: tokenId,
          metadata: { source: 'PASSWORD_RESET_REQUEST', deliveryMode: deliveryMode(), expiresAt },
          newData: { id: tokenId, userId: user.id, email: user.email, expiresAt },
        });
      }
    });

    const resetLink = buildResetLink(rawToken);
    await sendPasswordResetEmail({
      to: user.email,
      resetLink,
      expiresAt,
    });

    const delivery = shouldExposeEmailDebugLinks()
      ? {
          mode: deliveryMode(),
          resetLink,
        }
      : {
          mode: deliveryMode(),
        };

    const res = NextResponse.json({
      ok: true,
      delivery,
    });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch {
    return NextResponse.json({ error: 'No se pudo solicitar la recuperacion de contraseña.' }, { status: 500 });
  }
}
