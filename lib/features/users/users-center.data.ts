import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { clientsRepo, type ClientAccount } from '@/lib/repos/core/clients.repo';
import { usersRepo } from '@/lib/repos/users/users.repo';
import type { Building, Unit, User } from '@/lib/types';

export type AdminUsersPageData = {
  users: User[];
  buildings: Building[];
  units: Unit[];
  clients: ClientAccount[];
};

export async function loadAdminUsersPageData(user: User): Promise<AdminUsersPageData> {
  const [users, buildings, units, clients] = await Promise.all([
    usersRepo.listForUser(user),
    buildingsRepo.listForUser(user),
    unitsRepo.listForUser(user),
    clientsRepo.listForUser(user),
  ]);

  return {
    users,
    buildings,
    units,
    clients,
  };
}

export async function createClientForRoot(
  user: User,
  input: { name: string; slug?: string }
): Promise<ClientAccount> {
  return clientsRepo.createForRoot(user, input);
}

export async function updateAdminUserStatus(user: User, input: { userId: string; status: 'ACTIVE' | 'SUSPENDED' }): Promise<User> {
  return usersRepo.updateStatusForUser(user, input);
}



export async function updateAdminUserProfile(
  user: User,
  input: {
    userId: string;
    name: string;
    email: string;
  }
): Promise<User> {
  return usersRepo.updateProfileForUser(user, input);
}
