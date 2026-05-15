import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateApiMutationOrigin } from '@/lib/server/security/origin-guard';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const originGuard = validateApiMutationOrigin(req);
  if (!originGuard.ok) {
    return NextResponse.json({ error: originGuard.error }, { status: originGuard.status });
  }

  const isPrivate =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/staff' ||
    pathname.startsWith('/staff/') ||
    pathname === '/resident' ||
    pathname.startsWith('/resident/');

  if (!isPrivate) return NextResponse.next();

  const session = req.cookies.get('ps_session')?.value;
  const looksValid =
    typeof session === 'string' &&
    (/^sess_[0-9a-fA-F-]{36}$/.test(session) ||
      (process.env.NODE_ENV === 'development' && /^mock_[a-zA-Z0-9_-]+$/.test(session)));
  if (!looksValid) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('next', pathname);
    const res = NextResponse.redirect(url);
    res.cookies.set('ps_session', '', { path: '/', expires: new Date(0) });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin/:path*', '/staff/:path*', '/resident/:path*'],
};

