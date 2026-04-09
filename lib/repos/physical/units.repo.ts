import { Unit, User } from '@/lib/types';
import { MOCK_UNITS } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const unitsRepo = {
  async listForUser(user: User): Promise<Unit[]> {
    await sleep(300);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_UNITS
        : user.clientId
          ? MOCK_UNITS.filter((u) => u.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      if (!user.buildingId) return [];
      return tenantScoped.filter((u) => u.buildingId === user.buildingId);
    }

    if (user.internalRole === 'OWNER') {
      const unitIds = assignmentsRepo.listUnitIdsForOwner(user);
      return tenantScoped.filter((u) => unitIds.includes(u.id));
    }

    if (user.unitId) {
      return tenantScoped.filter((u) => u.id === user.unitId);
    }

    return [];
  },
};
