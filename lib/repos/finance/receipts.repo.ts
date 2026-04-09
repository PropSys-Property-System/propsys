import { Receipt, User } from '@/lib/types';
import { MOCK_RECEIPTS } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const receiptsRepo = {
  async listForUser(user: User): Promise<Receipt[]> {
    await sleep(350);

    const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);

    if (accessScope(user) === 'PORTFOLIO') {
      if (user.scope === 'platform') return MOCK_RECEIPTS;
      return MOCK_RECEIPTS.filter((r) => buildingIds.includes(r.buildingId));
    }

    if (accessScope(user) === 'BUILDING') {
      if (!user.buildingId) return [];
      if (user.scope === 'platform') return MOCK_RECEIPTS.filter((r) => r.buildingId === user.buildingId);
      if (!buildingIds.includes(user.buildingId)) return [];
      return MOCK_RECEIPTS.filter((r) => r.buildingId === user.buildingId);
    }

    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    return MOCK_RECEIPTS.filter((r) => unitIds.includes(r.unitId));
  },

  async getByIdForUser(user: User, id: string): Promise<Receipt | null> {
    const list = await receiptsRepo.listForUser(user);
    return list.find((r) => r.id === id) ?? null;
  },
};
