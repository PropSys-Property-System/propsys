import { CommonArea, User } from '@/lib/types';
import { MOCK_COMMON_AREAS } from '@/lib/mocks';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const commonAreasRepo = {
  async listForBuilding(user: User, buildingId: string): Promise<CommonArea[]> {
    await sleep(250);

    if (user.scope === 'platform') return MOCK_COMMON_AREAS.filter((a) => a.buildingId === buildingId);
    if (!user.clientId) return [];

    return MOCK_COMMON_AREAS.filter((a) => a.buildingId === buildingId && a.clientId === user.clientId);
  },
};
