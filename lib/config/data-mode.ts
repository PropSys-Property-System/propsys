export type DataMode = 'mock' | 'db';

export function getDataMode(): DataMode {
  const v =
    (process.env.NEXT_PUBLIC_DATA_MODE as DataMode | undefined) ??
    (process.env.DATA_MODE as DataMode | undefined) ??
    'db';
  if (v !== 'mock') return 'db';
  const allow =
    process.env.NODE_ENV === 'test' ||
    process.env.NEXT_PUBLIC_ALLOW_MOCK_MODE === '1' ||
    process.env.ALLOW_MOCK_MODE === '1';
  return allow ? 'mock' : 'db';
}

export function isDbMode(): boolean {
  return getDataMode() === 'db';
}

