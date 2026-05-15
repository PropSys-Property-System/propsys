const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const SESSION_COOKIE_NAME = 'ps_session';

export type OriginGuardResult =
  | { ok: true }
  | { ok: false; status: 403; error: 'Origen no permitido' };

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

function requestOrigin(req: Request): string | null {
  try {
    return new URL(req.url).origin.toLowerCase();
  } catch {
    return null;
  }
}

function envOrigin(name: string): string | null {
  return normalizeOrigin(process.env[name]);
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

function allowedOriginsForRequest(req: Request): Set<string> {
  const allowed = new Set<string>();
  const current = requestOrigin(req);
  const appUrl = envOrigin('PROPSYS_APP_URL');
  const publicAppUrl = envOrigin('NEXT_PUBLIC_APP_URL');

  if (current) allowed.add(current);
  if (appUrl) allowed.add(appUrl);
  if (publicAppUrl) allowed.add(publicAppUrl);

  return allowed;
}

function isAllowedOrigin(origin: string | null, allowedOrigins: Set<string>) {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;
  return process.env.NODE_ENV !== 'production' && isLocalhostOrigin(origin);
}

function hasSessionCookie(req: Request): boolean {
  return req.headers
    .get('cookie')
    ?.split(';')
    .some((part) => part.trim().startsWith(`${SESSION_COOKIE_NAME}=`)) ?? false;
}

function isApiPath(req: Request): boolean {
  try {
    return new URL(req.url).pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function forbidden(): OriginGuardResult {
  return { ok: false, status: 403, error: 'Origen no permitido' };
}

export function shouldApplyOriginGuard(req: Request): boolean {
  return MUTATING_METHODS.has(req.method.toUpperCase()) && isApiPath(req);
}

export function validateApiMutationOrigin(req: Request): OriginGuardResult {
  if (!shouldApplyOriginGuard(req)) return { ok: true };

  const fetchSite = req.headers.get('sec-fetch-site')?.trim().toLowerCase() ?? '';
  if (fetchSite === 'cross-site') return forbidden();

  const allowedOrigins = allowedOriginsForRequest(req);
  const origin = normalizeOrigin(req.headers.get('origin'));
  if (origin) {
    return isAllowedOrigin(origin, allowedOrigins) ? { ok: true } : forbidden();
  }

  if (process.env.NODE_ENV === 'production' && hasSessionCookie(req)) {
    const refererOrigin = normalizeOrigin(req.headers.get('referer'));
    return isAllowedOrigin(refererOrigin, allowedOrigins) ? { ok: true } : forbidden();
  }

  return { ok: true };
}