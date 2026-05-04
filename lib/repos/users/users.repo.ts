import { User } from '@/lib/types';
import { MOCK_USERS } from '@/lib/mocks';
import { canManageUserLifecycle, filterItemsByTenant, requireClientContext } from '@/lib/auth/access-rules';
import { accessScope } from '@/lib/access/access-scope';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type CreateUserInput = {
  name: string;
  email: string;
  internalRole: 'BUILDING_ADMIN' | 'STAFF' | 'OWNER' | 'OCCUPANT';
  buildingId?: string;
  unitId?: string;
  password?: string;
};

type UpdateUserInput = {
  userId: string;
  name: string;
  email: string;
};

function mapInternalRoleToUIRole(internalRole: CreateUserInput['internalRole']): User['role'] {
  switch (internalRole) {
    case 'BUILDING_ADMIN':
      return 'BUILDING_ADMIN';
    case 'STAFF':
      return 'STAFF';
    case 'OWNER':
      return 'OWNER';
    case 'OCCUPANT':
      return 'TENANT';
  }
}

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

  async createForUser(user: User, input: CreateUserInput): Promise<{ user: User; tempPassword?: string }> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ user: User; tempPassword?: string }>('/api/v1/users', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      return data;
    }

    await sleep(250);
    if (accessScope(user) !== 'PORTFOLIO') throw new Error('No autorizado');

    const clientId = requireClientContext(user);
    const normalizedEmail = input.email.trim().toLowerCase();
    const duplicate = MOCK_USERS.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);
    if (duplicate) throw new Error('Ese email ya existe');

    const created: User = {
      id: `u_mock_${Date.now()}`,
      name: input.name.trim(),
      email: normalizedEmail,
      internalRole: input.internalRole,
      role: mapInternalRoleToUIRole(input.internalRole),
      clientId,
      scope: 'client',
      status: 'ACTIVE',
      buildingId: input.buildingId,
      unitId: input.unitId,
    };
    MOCK_USERS.push(created);
    return { user: { ...created } };
  },

  async updateProfileForUser(user: User, input: UpdateUserInput): Promise<User> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ user: User }>(`/api/v1/users/${input.userId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: input.name, email: input.email }),
      });
      return data.user;
    }

    await sleep(250);

    const target = MOCK_USERS.find((item) => item.id === input.userId);
    if (!target) throw new Error('Usuario no encontrado.');
    if (!canManageUserLifecycle(user, target)) throw new Error('No autorizado');

    const normalizedEmail = input.email.trim().toLowerCase();
    const duplicate = MOCK_USERS.find((candidate) => candidate.id !== target.id && candidate.email.toLowerCase() === normalizedEmail);
    if (duplicate) throw new Error('Ese email ya existe');

    target.name = input.name.trim();
    target.email = normalizedEmail;
    return { ...target };
  },
};
