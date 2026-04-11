import { User } from '@/lib/types';
import { MOCK_USERS } from '@/lib/mocks';
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
    if (user.scope === 'platform') return MOCK_USERS;
    if (!user.clientId) return [];
    return MOCK_USERS.filter((u) => u.clientId === user.clientId);
  },
};

