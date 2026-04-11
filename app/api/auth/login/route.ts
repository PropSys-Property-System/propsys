import { NextResponse } from 'next/server';
import argon2 from 'argon2';
import { getPool } from '@/lib/server/db/client';
import { randomUUID } from 'node:crypto';

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

  if (row.client_id) {
    await pool
      .query(
        `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, new_data)
         VALUES ($1, $2, $3, 'LOGIN', 'AuthSession', $4, $5::jsonb, $6::jsonb)`,
        [
          `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
          row.client_id,
          row.id,
          sessionId,
          JSON.stringify({ userAgent: req.headers.get('user-agent') ?? null }),
          JSON.stringify({ sessionId, expiresAt: expiresAt.toISOString() }),
        ]
      )
      .catch(() => null);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('ps_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  return res;
}

