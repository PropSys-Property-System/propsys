import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import type { User } from '@/lib/types';

export async function GET(req: Request) {
  const sessionUser = await getSessionUser(req);
  if (!sessionUser) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (sessionUser.internalRole !== 'ROOT_ADMIN' && sessionUser.internalRole !== 'CLIENT_MANAGER') {
    return NextResponse.json({ users: [] as User[] });
  }

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(sessionUser);
  if (!bypassTenant && !sessionUser.clientId) return NextResponse.json({ users: [] as User[] });
  const rows = await pool.query<{
    id: string;
    email: string;
    name: string;
    role: string;
    internal_role: string;
    client_id: string | null;
    scope: string;
    status: string;
  }>(
    bypassTenant
      ? 'SELECT id, email, name, role, internal_role, client_id, scope, status FROM users ORDER BY name ASC'
      : 'SELECT id, email, name, role, internal_role, client_id, scope, status FROM users WHERE client_id = $1 ORDER BY name ASC',
    bypassTenant ? [] : [sessionUser.clientId]
  );

  const users: User[] = rows.rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as User['role'],
    internalRole: u.internal_role as User['internalRole'],
    clientId: u.client_id,
    scope: u.scope as User['scope'],
    status: u.status as User['status'],
  }));

  return NextResponse.json({ users });
}


