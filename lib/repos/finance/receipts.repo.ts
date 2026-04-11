import { Receipt, User } from '@/lib/types';
import { MOCK_RECEIPTS } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const receiptsRepo = {
  async listForUser(user: User): Promise<Receipt[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ receipts: Receipt[] }>('/api/v1/finance/receipts', { credentials: 'include' });
      return data.receipts;
    }
    await sleep(350);

    const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);

    if (accessScope(user) === 'PORTFOLIO') {
      if (user.scope === 'platform') return MOCK_RECEIPTS;
      return MOCK_RECEIPTS.filter((r) => buildingIds.includes(r.buildingId));
    }

    if (accessScope(user) === 'BUILDING') {
      if (buildingIds.length === 0) return [];
      return MOCK_RECEIPTS.filter((r) => buildingIds.includes(r.buildingId));
    }

    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    return MOCK_RECEIPTS.filter((r) => unitIds.includes(r.unitId));
  },

  async getByIdForUser(user: User, id: string): Promise<Receipt | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/finance/receipts/${id}`, { credentials: 'include' });
      if (res.status === 404) return null;
      if (!res.ok) {
        const ct = res.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || `Error HTTP ${res.status}`);
        }
        throw new Error(`Error HTTP ${res.status}`);
      }
      const data = (await res.json().catch(() => null)) as { receipt?: Receipt | null } | null;
      return data?.receipt ?? null;
    }
    const list = await receiptsRepo.listForUser(user);
    return list.find((r) => r.id === id) ?? null;
  },
};

