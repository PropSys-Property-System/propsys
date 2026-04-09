import { StaffMember, User } from '@/lib/types';
import { MOCK_BUILDINGS, MOCK_STAFF_MEMBERS } from '@/lib/mocks';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const staffRepo = {
  async listForBuilding(user: User, buildingId: string): Promise<StaffMember[]> {
    await sleep(300);

    if (user.scope === 'platform') return MOCK_STAFF_MEMBERS.filter((s) => s.buildingId === buildingId);
    if (!user.clientId) return [];

    const building = MOCK_BUILDINGS.find((b) => b.id === buildingId);
    if (!building?.clientId || building.clientId !== user.clientId) return [];

    return MOCK_STAFF_MEMBERS.filter((s) => s.buildingId === buildingId);
  },
};
