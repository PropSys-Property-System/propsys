import { getPool } from '@/lib/server/db/client';

export type SessionUser = {
  id: string;
  clientId: string | null;
  email: string;
  name: string;
  role: string;
  internalRole: string;
  scope: string;
  status: string;
};

function parseCookie(req: Request, name: string) {
  const cookie = req.headers.get('cookie') ?? '';
  return cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${name}=`))
    ?.split('=')[1];
}

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const sessionId = parseCookie(req, 'ps_session');
  if (!sessionId) return null;

  const pool = getPool();
  const sRes = await pool.query<{ user_id: string; client_id: string | null }>(
    'SELECT user_id, client_id FROM auth_sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > now() LIMIT 1',
    [sessionId]
  );
  const s = sRes.rows[0];
  if (!s) return null;

  const uRes = await pool.query<{
    id: string;
    email: string;
    name: string;
    role: string;
    internal_role: string;
    client_id: string | null;
    scope: string;
    status: string;
  }>('SELECT id, email, name, role, internal_role, client_id, scope, status FROM users WHERE id = $1 LIMIT 1', [s.user_id]);
  const u = uRes.rows[0];
  if (!u) return null;

  if (u.status !== 'ACTIVE') {
    await pool.query('UPDATE auth_sessions SET revoked_at = now() WHERE id = $1', [sessionId]).catch(() => null);
    return null;
  }

  return {
    id: u.id,
    clientId: u.client_id,
    email: u.email,
    name: u.name,
    role: u.role,
    internalRole: u.internal_role,
    scope: u.scope,
    status: u.status,
  };
}

