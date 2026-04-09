import { Building, User } from '@/lib/types';
import { MOCK_BUILDINGS } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const buildingsRepo = {
  async listForUser(user: User): Promise<Building[]> {
    await sleep(300);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_BUILDINGS
        : user.clientId
          ? MOCK_BUILDINGS.filter((b) => b.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;
    if (!user.buildingId) return [];
    return tenantScoped.filter((b) => b.id === user.buildingId);
  },
};
