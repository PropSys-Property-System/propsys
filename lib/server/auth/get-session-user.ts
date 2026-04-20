import { getPool } from '@/lib/server/db/client';
import { mapInternalRoleToUIRole } from '@/lib/auth/role-mapping';
import { getSessionIdFromRequest } from '@/lib/server/auth/session-cookie';
import type { AuthScope, InternalRole, UIRole, UserStatus } from '@/lib/types/auth';

export type SessionUser = {
  id: string;
  clientId: string | null;
  email: string;
  name: string;
  role: UIRole;
  internalRole: InternalRole;
  scope: AuthScope;
  status: UserStatus;
};

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const sessionId = getSessionIdFromRequest(req);
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

  let role: UIRole;
  try {
    role = mapInternalRoleToUIRole(u.internal_role as InternalRole);
  } catch {
    return null;
  }

  return {
    id: u.id,
    clientId: u.client_id,
    email: u.email,
    name: u.name,
    role,
    internalRole: u.internal_role as InternalRole,
    scope: u.scope as AuthScope,
    status: u.status as UserStatus,
  };
}

