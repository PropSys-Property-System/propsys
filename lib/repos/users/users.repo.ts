import { User } from '@/lib/types';
import { MOCK_USERS } from '@/lib/mocks';
import { canManageUserLifecycle, filterItemsByTenant } from '@/lib/auth/access-rules';
import { accessScope } from '@/lib/access/access-scope';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const usersRepo = {
  async listForUser(user: User): Promise<User[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ users: User[] }>('/api/v1/users', { credentials: 'include' });
      return data.users;
    }
    await sleep(250);
    if (accessScope(user) !== 'PORTFOLIO') return [];
    return filterItemsByTenant(MOCK_USERS, user);
  },

  async updateStatusForUser(user: User, input: { userId: string; status: 'ACTIVE' | 'SUSPENDED' }): Promise<User> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ user: User }>(`/api/v1/users/${input.userId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: input.status }),
      });
      return data.user;
    }

    await sleep(250);

    const target = MOCK_USERS.find((item) => item.id === input.userId);
    if (!target) throw new Error('Usuario no encontrado.');
    if (!canManageUserLifecycle(user, target)) throw new Error('No autorizado');

    target.status = input.status;
    return { ...target };
  },
};
