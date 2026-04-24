import { StaffMember, User } from '@/lib/types';
import { MOCK_BUILDINGS, MOCK_STAFF_MEMBERS } from '@/lib/mocks';
import { canAccessClientRecord } from '@/lib/auth/access-rules';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CreateStaffForBuildingInput = {
  buildingId: string;
  name: string;
  email: string;
  password?: string;
};

export type CreateStaffForBuildingResult = {
  staff: StaffMember;
  tempPassword?: string;
};

export const staffRepo = {
  async listForBuilding(user: User, buildingId: string): Promise<StaffMember[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ staff: StaffMember[] }>(`/api/v1/physical/staff?buildingId=${encodeURIComponent(buildingId)}`, {
        credentials: 'include',
      });
      return data.staff;
    }
    await sleep(300);

    const building = MOCK_BUILDINGS.find((b) => b.id === buildingId);
    if (!building?.clientId || !canAccessClientRecord(user, building.clientId)) return [];

    if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
      if (!assignmentsRepo.isAssignedToBuilding(user, buildingId)) return [];
    }

    return MOCK_STAFF_MEMBERS.filter((s) => s.buildingId === buildingId);
  },

  async createForBuilding(user: User, input: CreateStaffForBuildingInput): Promise<CreateStaffForBuildingResult> {
    if (isDbMode()) {
      return fetchJsonOrThrow<CreateStaffForBuildingResult>('/api/v1/physical/staff', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    }

    await sleep(250);

    const building = MOCK_BUILDINGS.find((b) => b.id === input.buildingId);
    if (!building?.clientId || !canAccessClientRecord(user, building.clientId)) {
      throw new Error('No autorizado');
    }

    if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
      if (!assignmentsRepo.isAssignedToBuilding(user, input.buildingId)) {
        throw new Error('No autorizado');
      }
    }

    const staff: StaffMember = {
      id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      buildingId: input.buildingId,
      name: input.name.trim(),
      role: 'Personal',
      status: 'ACTIVE',
    };

    MOCK_STAFF_MEMBERS.unshift(staff);

    return {
      staff,
      tempPassword: input.password,
    };
  },
};
