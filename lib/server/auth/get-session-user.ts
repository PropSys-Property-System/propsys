import { getPool } from '@/lib/server/db/client';
import { mapInternalRoleToUIRole } from '@/lib/auth/role-mapping';
import { getSessionIdFromRequest } from '@/lib/server/auth/session-cookie';
import type { AuthScope, InternalRole, UIRole, UserStatus } from '@/lib/types/auth';
import { MOCK_ROOT_ADMIN, MOCK_USERS } from '@/lib/mocks';

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

export function canUseMockSession(): boolean {
  return process.env.NODE_ENV === 'development';
}

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) return null;

  if (sessionId.startsWith('mock_')) {
    if (!canUseMockSession()) return null;
    const userId = sessionId.slice('mock_'.length);
    const u = [MOCK_ROOT_ADMIN, ...MOCK_USERS].find((x) => x.id === userId);
    if (!u) return null;
    return {
      id: u.id,
      clientId: u.clientId ?? null,
      email: u.email,
      name: u.name,
      role: u.role as UIRole,
      internalRole: u.internalRole as InternalRole,
      scope: u.scope as AuthScope,
      status: u.status as UserStatus,
    };
  }

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

