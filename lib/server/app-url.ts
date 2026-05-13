const DEFAULT_LOCAL_APP_URL = 'http://localhost:3000';

function parseCanonicalAppUrl(value: string, source: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${source} debe ser una URL absoluta valida.`);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${source} debe usar http o https.`);
  }

  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error(`${source} debe usar https en produccion.`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${source} no debe incluir credenciales.`);
  }

  return new URL(parsed.origin);
}

export function getCanonicalAppUrl(): URL {
  const appUrl = process.env.PROPSYS_APP_URL?.trim();
  if (appUrl) return parseCanonicalAppUrl(appUrl, 'PROPSYS_APP_URL');

  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (publicAppUrl) return parseCanonicalAppUrl(publicAppUrl, 'NEXT_PUBLIC_APP_URL');

  if (process.env.NODE_ENV === 'production') {
    throw new Error('PROPSYS_APP_URL debe estar configurada en produccion.');
  }

  return new URL(DEFAULT_LOCAL_APP_URL);
}

export function buildCanonicalAppUrl(pathname: string, searchParams: Record<string, string> = {}): string {
  if (!pathname.startsWith('/')) {
    throw new Error('La ruta canonica debe empezar con /.');
  }

  const url = new URL(pathname, getCanonicalAppUrl());
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
