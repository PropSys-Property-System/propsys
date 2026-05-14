import { clientsRepo, type ClientAccount } from '@/lib/repos/core/clients.repo';
import type { User } from '@/lib/types';

export async function listAdminClients(user: User, includeSuspended: boolean = false): Promise<ClientAccount[]> {
  return clientsRepo.listForUser(user, { includeSuspended });
}

export async function createAdminClient(user: User, input: { name: string }): Promise<ClientAccount> {
  return clientsRepo.createForRoot(user, input);
}

export async function updateAdminClientStatus(user: User, input: { id: string; status: 'ACTIVE' | 'SUSPENDED' }): Promise<ClientAccount> {
  return clientsRepo.updateForRoot(user, { id: input.id, status: input.status });
}

export async function updateAdminClientProfile(user: User, input: { id: string; name: string }): Promise<ClientAccount> {
  return clientsRepo.updateForRoot(user, { id: input.id, name: input.name });
}
