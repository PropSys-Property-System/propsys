import { NextResponse } from 'next/server';
import argon2 from 'argon2';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { checkRateLimit, hashRateLimitKey, rateLimitExceededHeaders } from '@/lib/server/security/rate-limit';

const CHANGE_PASSWORD_RATE_LIMIT = 10;
const CHANGE_PASSWORD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function validateAccountPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

export async function POST(req: Request) {
  const actor = await getSessionUser(req);
  if (!actor) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Rate limit by userId
  const rlKey = hashRateLimitKey('change-password', actor.id);
  const rlCheck = await checkRateLimit(rlKey, CHANGE_PASSWORD_RATE_LIMIT, CHANGE_PASSWORD_WINDOW_MS).catch(() => null);
  if (rlCheck && !rlCheck.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta nuevamente mas tarde.' },
      { status: 429, headers: rateLimitExceededHeaders(rlCheck.retryAfter) }
    );
  }

  const body = await req.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
  const confirmPassword = typeof body?.confirmPassword === 'string' ? body.confirmPassword : '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'Todos los campos son requeridos.' }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'La nueva contrasena y la confirmacion no coinciden.' }, { status: 400 });
  }

  if (!validateAccountPassword(newPassword)) {
    return NextResponse.json(
      { error: 'La nueva contrasena debe tener al menos 8 caracteres, incluir una letra y un numero.' },
      { status: 400 }
    );
  }

  const pool = getPool();

  // Fetch current hash — select only what we need, never return it
  const userRes = await pool.query<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = $1 LIMIT 1',
    [actor.id]
  );
  const row = userRes.rows[0];
  if (!row || !row.password_hash) {
    return NextResponse.json({ error: 'No se pudo verificar la identidad.' }, { status: 400 });
  }

  const valid = await argon2.verify(row.password_hash, currentPassword).catch(() => false);
  if (!valid) {
    return NextResponse.json({ error: 'La contrasena actual es incorrecta.' }, { status: 400 });
  }

  const newHash = await argon2.hash(newPassword);
  const now = new Date().toISOString();

  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
    [newHash, now, actor.id]
  );

  // Audit log — no hashes, no passwords
  await insertAuditLog(pool, {
    clientId: actor.clientId ?? 'system',
    userId: actor.id,
    action: 'CHANGE_PASSWORD',
    entity: 'User',
    entityId: actor.id,
    metadata: { source: 'account_settings' },
  }).catch(() => null);

  const res = NextResponse.json({ ok: true });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
