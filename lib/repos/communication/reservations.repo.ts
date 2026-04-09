import { Reservation, User } from '@/lib/types';
import { MOCK_RESERVATIONS } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const reservationsRepo = {
  async listForUser(user: User): Promise<Reservation[]> {
    await sleep(350);

    const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);

    if (accessScope(user) === 'PORTFOLIO') {
      if (user.scope === 'platform') return MOCK_RESERVATIONS;
      return MOCK_RESERVATIONS.filter((r) => buildingIds.includes(r.buildingId));
    }

    if (accessScope(user) === 'BUILDING') {
      if (!user.buildingId) return [];
      if (user.scope === 'platform') return MOCK_RESERVATIONS.filter((r) => r.buildingId === user.buildingId);
      if (!buildingIds.includes(user.buildingId)) return [];
      return MOCK_RESERVATIONS.filter((r) => r.buildingId === user.buildingId);
    }

    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    return MOCK_RESERVATIONS.filter((r) => unitIds.includes(r.unitId));
  },
};
