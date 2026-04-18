import { NextResponse } from 'next/server';
import argon2 from 'argon2';
import { getPool } from '@/lib/server/db/client';
import { randomUUID } from 'node:crypto';
import { insertAuditLog } from '@/lib/server/audit/audit-log';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 400 });
  }

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
  res.cookies.set('ps_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return res;
}

