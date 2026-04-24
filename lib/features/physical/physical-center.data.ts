import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { commonAreasRepo } from '@/lib/repos/physical/common-areas.repo';
import { staffRepo } from '@/lib/repos/physical/staff.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import type { Building, CommonArea, StaffMember, Unit, User } from '@/lib/types';

export type AdminBuildingsPageData = {
  buildings: Building[];
};

export type AdminStaffPageData = {
  buildings: Building[];
  defaultBuildingId: string;
};

export type ResidentUnitsPageData = {
  units: Unit[];
  buildings: Building[];
};

export type AdminCommonAreasPageData = {
  buildings: Building[];
  defaultBuildingId: string;
};

export async function loadAdminBuildingsPageData(user: User): Promise<AdminBuildingsPageData> {
  return {
    buildings: await buildingsRepo.listForUser(user),
  };
}

export async function loadAdminStaffPageData(user: User): Promise<AdminStaffPageData> {
  const buildings = await buildingsRepo.listForUser(user);

  return {
    buildings,
    defaultBuildingId: buildings[0]?.id ?? '',
  };
}

export async function listStaffForBuilding(user: User, buildingId: string): Promise<StaffMember[]> {
  return staffRepo.listForBuilding(user, buildingId);
}

export async function createStaffForBuilding(
  user: User,
  input: Parameters<typeof staffRepo.createForBuilding>[1]
): Promise<Awaited<ReturnType<typeof staffRepo.createForBuilding>>> {
  return staffRepo.createForBuilding(user, input);
}

export async function loadAdminCommonAreasPageData(user: User): Promise<AdminCommonAreasPageData> {
  const buildings = await buildingsRepo.listForUser(user);

  return {
    buildings,
    defaultBuildingId: buildings[0]?.id ?? '',
  };
}

export async function listCommonAreasForBuilding(user: User, buildingId: string): Promise<CommonArea[]> {
  return commonAreasRepo.listForBuilding(user, buildingId);
}

export async function updateCommonAreaApprovalForUser(user: User, id: string, requiresApproval: boolean): Promise<CommonArea> {
  return commonAreasRepo.updateRequiresApprovalForUser(user, id, requiresApproval);
}

export async function loadResidentUnitsPageData(user: User): Promise<ResidentUnitsPageData> {
  const [units, buildings] = await Promise.all([unitsRepo.listForUser(user), buildingsRepo.listForUser(user)]);

  return {
    units,
    buildings,
  };
}
