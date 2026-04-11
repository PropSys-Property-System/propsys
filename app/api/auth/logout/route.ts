import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { randomUUID } from 'node:crypto';

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') ?? '';
  const sessionId = cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('ps_session='))
    ?.split('=')[1];

  if (sessionId) {
    const pool = getPool();
    const sRes = await pool
      .query<{ user_id: string; client_id: string | null }>('SELECT user_id, client_id FROM auth_sessions WHERE id = $1 LIMIT 1', [sessionId])
      .catch(() => null);
    await pool.query('UPDATE auth_sessions SET revoked_at = now() WHERE id = $1', [sessionId]).catch(() => null);
    const s = sRes?.rows?.[0];
    if (s?.user_id && s.client_id) {
      await pool
        .query(
          `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata)
           VALUES ($1, $2, $3, 'LOGOUT', 'AuthSession', $4, $5::jsonb)`,
          [
            `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
            s.client_id,
            s.user_id,
            sessionId,
            JSON.stringify({ userAgent: req.headers.get('user-agent') ?? null }),
          ]
        )
        .catch(() => null);
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('ps_session', '', { path: '/', expires: new Date(0) });
  return res;
}

