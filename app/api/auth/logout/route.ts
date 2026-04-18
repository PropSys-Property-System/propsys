import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { insertAuditLog } from '@/lib/server/audit/audit-log';

export async function POST(req: Request) {
  const cookie = req.headers.get('cookie') ?? '';
  const sessionId = cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('ps_session='))
    ?.split('=')[1];

  let auditFailed = false;
  try {
    if (sessionId) {
      const pool = getPool();
      const sRes = await pool.query<{ user_id: string; client_id: string | null }>(
        'SELECT user_id, client_id FROM auth_sessions WHERE id = $1 LIMIT 1',
        [sessionId]
      );
      await pool.query('UPDATE auth_sessions SET revoked_at = now() WHERE id = $1', [sessionId]);
      const s = sRes.rows[0];
      if (s?.user_id && s.client_id) {
        try {
          await insertAuditLog(pool, {
            clientId: s.client_id,
            userId: s.user_id,
            action: 'LOGOUT',
            entity: 'AuthSession',
            entityId: sessionId,
            metadata: { userAgent: req.headers.get('user-agent') ?? null },
          });
        } catch {
          auditFailed = true;
        }
      }
    }
  } catch {
    const res = NextResponse.json({ ok: false, error: 'No pudimos cerrar la sesión.' }, { status: 500 });
    if (auditFailed) res.headers.set('x-propsys-audit', 'failed');
    res.cookies.set('ps_session', '', { path: '/', expires: new Date(0) });
    return res;
  }

  const res = NextResponse.json({ ok: true });
  if (auditFailed) res.headers.set('x-propsys-audit', 'failed');
  res.cookies.set('ps_session', '', { path: '/', expires: new Date(0) });
  return res;
}

