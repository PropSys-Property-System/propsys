import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { usersRepo } from '@/lib/repos/users/users.repo';
import type { Building, Unit, User } from '@/lib/types';

export type AdminUsersPageData = {
  users: User[];
  buildings: Building[];
  units: Unit[];
};

export async function loadAdminUsersPageData(user: User): Promise<AdminUsersPageData> {
  const [users, buildings, units] = await Promise.all([
    usersRepo.listForUser(user),
    buildingsRepo.listForUser(user),
    unitsRepo.listForUser(user),
  ]);

  return {
    users,
    buildings,
    units,
  };
}

export async function updateAdminUserStatus(user: User, input: { userId: string; status: 'ACTIVE' | 'SUSPENDED' }): Promise<User> {
  return usersRepo.updateStatusForUser(user, input);
}
