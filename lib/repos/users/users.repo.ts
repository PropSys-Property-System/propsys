import { User } from '@/lib/types';
import { MOCK_USERS } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const usersRepo = {
  async listForUser(user: User): Promise<User[]> {
    await sleep(250);
    if (accessScope(user) !== 'PORTFOLIO') return [];
    return MOCK_USERS;
  },
};
