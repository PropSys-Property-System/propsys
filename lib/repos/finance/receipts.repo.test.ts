import { afterEach, describe, expect, it, vi } from 'vitest';
import { receiptsRepo } from './receipts.repo';
import type { User } from '@/lib/types';

const ownerUser: User = {
  id: 'u_owner',
  email: 'owner@propsys.com',
  name: 'Owner',
  role: 'OWNER',
  internalRole: 'OWNER',
  clientId: 'client_001',
  scope: 'client',
  status: 'ACTIVE',
};

describe('receipts repo data mode', () => {
  const previousFetch = globalThis.fetch;

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    if (previousFetch) {
      globalThis.fetch = previousFetch;
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
  });

  it('uses finance receipts API when NEXT_PUBLIC_DATA_MODE=db in client-like runtime', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_DATA_MODE', 'db');
    delete process.env.DATABASE_URL;

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          receipts: [
            {
              id: 'rect_1',
              buildingId: 'b1',
              unitId: 'unit-101',
              number: 'REC-001',
              description: 'Mantenimiento',
              amount: 150,
              currency: 'PEN',
              issueDate: '2026-05-01',
              dueDate: '2026-06-01',
              status: 'PENDING',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const receipts = await receiptsRepo.listForUser(ownerUser);

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/finance/receipts', { credentials: 'include' });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]?.id).toBe('rect_1');
  });
});
