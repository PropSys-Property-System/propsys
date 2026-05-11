import { describe, expect, it } from 'vitest';
import { labelAccessScope, labelWorkspaceArea } from '@/lib/presentation/labels';
import type { User } from '@/lib/types';

function makeUser(overrides: Partial<User>): User {
  return {
    id: 'u-test',
    email: 'test@example.com',
    name: 'Usuario Test',
    role: 'MANAGER',
    internalRole: 'CLIENT_MANAGER',
    scope: 'client',
    status: 'ACTIVE',
    clientId: 'client_001',
    ...overrides,
  };
}

describe('shell presentation labels', () => {
  it('maps root platform users to Plataforma and Acceso global', () => {
    const user = makeUser({
      role: 'MANAGER',
      internalRole: 'ROOT_ADMIN',
      scope: 'platform',
      clientId: null,
    });

    expect(labelWorkspaceArea(user)).toBe('Plataforma');
    expect(labelAccessScope(user)).toBe('Acceso global');
  });

  it('maps resident roles to Portal residente', () => {
    const owner = makeUser({
      role: 'OWNER',
      internalRole: 'OWNER',
    });
    const occupant = makeUser({
      role: 'TENANT',
      internalRole: 'OCCUPANT',
      clientId: 'client_002',
    });

    expect(labelWorkspaceArea(owner)).toBe('Portal residente');
    expect(labelWorkspaceArea(occupant)).toBe('Portal residente');
  });

  it('uses tenant label for client-scoped users', () => {
    const manager = makeUser({
      clientId: 'client_002',
    });

    expect(labelAccessScope(manager)).toBe('Gestión Residencial Sur');
  });
});
