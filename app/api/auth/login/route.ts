import { NextResponse } from 'next/server';
import argon2 from 'argon2';
import { getPool } from '@/lib/server/db/client';
import { randomUUID } from 'node:crypto';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { setSessionCookie } from '@/lib/server/auth/session-cookie';
import { MOCK_ROOT_ADMIN, MOCK_USERS } from '@/lib/mocks';
import { checkLoginRateLimit, clearFailedLoginAttempts, recordFailedLoginAttempt } from '@/lib/server/auth/login-rate-limit';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 400 });
  }

  const rateLimit = checkLoginRateLimit(req, email);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: 'Demasiados intentos de inicio de sesion. Intenta nuevamente mas tarde.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const rejectLogin = async (error: string, status: number, delayMs = 350) => {
    await sleep(delayMs);
    recordFailedLoginAttempt(req, email);
    return NextResponse.json({ error }, { status });
  };

  const tryMockLogin = async () => {
    const u = [MOCK_ROOT_ADMIN, ...MOCK_USERS].find((x) => x.email.toLowerCase() === email);
    if (!u) {
      return rejectLogin('Credenciales inválidas', 401, 200);
    }
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    const res = NextResponse.json({ ok: true });
    clearFailedLoginAttempts(req, email);
    setSessionCookie(res, `mock_${u.id}`, expiresAt);
    return res;
  };

  if (process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL) {
    return tryMockLogin();
  }

  try {
    const pool = getPool();
    const userRes = await pool.query<{
      id: string;
      client_id: string | null;
      password_hash: string;
      status: string;
    }>('SELECT id, client_id, password_hash, status FROM users WHERE email = $1 LIMIT 1', [email]);

    const row = userRes.rows[0];
    if (!row) {
      return rejectLogin('Credenciales inválidas', 401);
    }

    if (row.status !== 'ACTIVE') {
      return rejectLogin('Usuario inactivo', 403);
    }

    const ok = await argon2.verify(row.password_hash, password).catch(() => false);
    if (!ok) {
      return rejectLogin('Credenciales inválidas', 401);
    }

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    const sessionId = `sess_${randomUUID()}`;
    await pool.query('INSERT INTO auth_sessions (id, user_id, client_id, expires_at) VALUES ($1, $2, $3, $4)', [
      sessionId,
      row.id,
      row.client_id,
      expiresAt.toISOString(),
    ]);

    let auditFailed = false;
    if (row.client_id) {
      try {
        await insertAuditLog(pool, {
          clientId: row.client_id,
          userId: row.id,
          action: 'LOGIN',
          entity: 'AuthSession',
          entityId: sessionId,
          metadata: { userAgent: req.headers.get('user-agent') ?? null },
          newData: { sessionId, expiresAt: expiresAt.toISOString() },
        });
      } catch {
        auditFailed = true;
      }
    }

    const res = NextResponse.json({ ok: true });
    if (auditFailed) res.headers.set('x-propsys-audit', 'failed');
    clearFailedLoginAttempts(req, email);
    setSessionCookie(res, sessionId, expiresAt);
    return res;
  } catch {
    if (process.env.NODE_ENV === 'development') {
      return tryMockLogin();
    }
    return NextResponse.json({ error: 'No se pudo iniciar sesión' }, { status: 500 });
  }
}

