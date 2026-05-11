import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser, type SessionUser } from '@/lib/server/auth/get-session-user';

export async function getSessionUserFromCookieHeader(cookieHeader: string | null): Promise<SessionUser | null> {
  if (!cookieHeader) return null;
  const req = new Request('http://localhost/_server_session', {
    method: 'GET',
    headers: { cookie: cookieHeader },
  });
  return getSessionUser(req);
}

export const getServerSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieHeader = (await headers()).get('cookie');
  return getSessionUserFromCookieHeader(cookieHeader);
});

export async function requireServerSessionUser(nextPath: string): Promise<SessionUser> {
  const user = await getServerSessionUser();
  if (!user) {
    redirect(`/?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}


