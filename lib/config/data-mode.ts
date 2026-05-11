export type DataMode = 'mock' | 'db';

export function getDataMode(): DataMode {
  const explicitMode =
    (process.env.NEXT_PUBLIC_DATA_MODE as DataMode | undefined) ??
    (process.env.DATA_MODE as DataMode | undefined);

  if (explicitMode === 'db') return 'db';

  const allow =
    process.env.NODE_ENV === 'test' ||
    process.env.NEXT_PUBLIC_ALLOW_MOCK_MODE === '1' ||
    process.env.ALLOW_MOCK_MODE === '1';

  if (explicitMode === 'mock') {
    if (process.env.NODE_ENV === 'production') return 'db';
    return allow ? 'mock' : 'db';
  }

  if (process.env.NODE_ENV === 'development') {
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser || !process.env.DATABASE_URL) return 'mock';
  }

  return 'db';
}

export function isDbMode(): boolean {
  return getDataMode() === 'db';
}

