import type { NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'ps_session';
const SESSION_COOKIE_PATH = '/';

function parseSessionId(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;

  return (
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.split('=')[1] ?? null
  );
}

export function getSessionIdFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  return parseSessionId(cookieHeader);
}

export function getSessionIdFromRequest(req: Request): string | null {
  return parseSessionId(req.headers.get('cookie'));
}

export function setSessionCookie(res: NextResponse, sessionId: string, expiresAt: Date): void {
  res.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: SESSION_COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    path: SESSION_COOKIE_PATH,
    expires: new Date(0),
  });
}
