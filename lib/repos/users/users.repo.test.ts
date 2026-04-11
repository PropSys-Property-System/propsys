import { describe, expect, it } from 'vitest';
import { usersRepo } from '@/lib/repos/users/users.repo';
import { MOCK_USERS } from '@/lib/mocks';
import type { User } from '@/lib/types';

function userBase(overrides: Partial<User>): User {
  return {
    id: 'u_test',
    email: 'test@propsys.local',
    name: 'Test',
    role: 'MANAGER',
    internalRole: 'CLIENT_MANAGER',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('usersRepo', () => {
  it('never leaks users across tenants for CLIENT_MANAGER', async () => {
    const manager = userBase({ id: 'u1', internalRole: 'CLIENT_MANAGER', role: 'MANAGER', clientId: 'client_001', scope: 'client' });
    const list = await usersRepo.listForUser(manager);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((u) => u.clientId === 'client_001')).toBe(true);
    expect(list.some((u) => u.clientId === 'client_002')).toBe(false);
  });

  it('platform scope can see all users', async () => {
    const root = userBase({ id: 'u0', internalRole: 'ROOT_ADMIN', role: 'MANAGER', clientId: null, scope: 'platform' });
    const list = await usersRepo.listForUser(root);
    expect(list.length).toBe(MOCK_USERS.length);
  });
});


