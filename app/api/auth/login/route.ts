import { NextResponse } from 'next/server';
import argon2 from 'argon2';
import { getPool } from '@/lib/server/db/client';
import { randomUUID } from 'node:crypto';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { setSessionCookie } from '@/lib/server/auth/session-cookie';
import { MOCK_ROOT_ADMIN, MOCK_USERS } from '@/lib/mocks';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 400 });
  }

  const tryMockLogin = async () => {
    const u = [MOCK_ROOT_ADMIN, ...MOCK_USERS].find((x) => x.email.toLowerCase() === email);
    if (!u) {
      await sleep(200);
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    const res = NextResponse.json({ ok: true });
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
      await sleep(350);
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    if (row.status !== 'ACTIVE') {
      await sleep(350);
      return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 });
    }

    const ok = await argon2.verify(row.password_hash, password).catch(() => false);
    if (!ok) {
      await sleep(350);
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
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
    setSessionCookie(res, sessionId, expiresAt);
    return res;
  } catch {
    if (process.env.NODE_ENV === 'development') {
      return tryMockLogin();
    }
    return NextResponse.json({ error: 'No se pudo iniciar sesión' }, { status: 500 });
  }
}

