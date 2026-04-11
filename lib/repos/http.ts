export async function fetchJsonOrThrow<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const resolvedInput =
    typeof window === 'undefined' && typeof input === 'string' && input.startsWith('/')
      ? new URL(input, process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
      : input;
  const res = await fetch(resolvedInput, init);
  if (!res.ok) {
    let msg = `Error HTTP ${res.status}`;
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (data?.error) msg = data.error;
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}
