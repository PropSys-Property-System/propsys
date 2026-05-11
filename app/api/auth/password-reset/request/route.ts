import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { addAccountTokenExpiry, generateAccountToken, hashAccountToken } from '@/lib/server/auth/account-token';
import { withTransaction } from '@/lib/server/db/tx';
import { isEmailProviderConfigured, sendPasswordResetEmail, shouldExposeEmailDebugLinks } from '@/lib/server/email/resend';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function normalizeEmail(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : '';
}

function deliveryMode(): 'resend' {
  return 'resend';
}

function buildResetLink(req: Request, token: string): string {
  const url = new URL('/reset-password', req.url);
  url.searchParams.set('token', token);
  return url.toString();
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

  if (!isEmailProviderConfigured()) {
    const res = NextResponse.json(
      { error: 'No hay proveedor de correo configurado para enviar recuperacion de contrasena. Reemplaza re_xxxxxxxxx por tu API key real de Resend.' },
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

    const resetLink = buildResetLink(req, rawToken);
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
    return NextResponse.json({ error: 'No se pudo solicitar la recuperacion de contrasena.' }, { status: 500 });
  }
}
