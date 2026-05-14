import { MOCK_CLIENTS } from '@/lib/mocks/core';
import { canBypassTenantScope } from '@/lib/auth/access-rules';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';
import type { User } from '@/lib/types';

export type ClientAccount = {
  id: string;
  slug?: string;
  name: string;
  status: string;
  createdAt?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toClientAccount(client: (typeof MOCK_CLIENTS)[number]): ClientAccount {
  return {
    id: client.id,
    slug: client.id,
    name: client.name,
    status: client.status,
    createdAt: client.createdAt,
  };
}

export const clientsRepo = {
  async listForUser(user: User): Promise<ClientAccount[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ clients: ClientAccount[] }>('/api/v1/clients', { credentials: 'include' });
      return data.clients;
    }

    await sleep(150);
    if (canBypassTenantScope(user)) return MOCK_CLIENTS.filter((client) => client.status === 'ACTIVE').map(toClientAccount);
    if (!user.clientId) return [];
    return MOCK_CLIENTS.filter((client) => client.id === user.clientId && client.status === 'ACTIVE').map(toClientAccount);
  },

  async createForRoot(user: User, input: { name: string; slug?: string }): Promise<ClientAccount> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ client: ClientAccount }>('/api/v1/clients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      return data.client;
    }

    await sleep(150);
    if (!canBypassTenantScope(user)) throw new Error('No autorizado');
    const name = input.name.trim();
    if (!name) throw new Error('Nombre de cliente invalido.');
    const normalizedName = name.toLowerCase();
    if (MOCK_CLIENTS.some((client) => client.name.trim().toLowerCase() === normalizedName)) {
      throw new Error('Ya existe un cliente con ese nombre.');
    }

    const now = new Date().toISOString();
    const client = {
      id: `client_mock_${Date.now()}`,
      name,
      taxId: '',
      status: 'ACTIVE' as const,
      createdAt: now,
      updatedAt: now,
    };
    MOCK_CLIENTS.push(client);
    return toClientAccount(client);
  },
};
