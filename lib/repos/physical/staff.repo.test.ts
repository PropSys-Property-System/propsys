import { describe, expect, it } from 'vitest';
import { staffRepo } from '@/lib/repos/physical/staff.repo';
import type { User } from '@/lib/types';

function userBase(overrides: Partial<User>): User {
  return {
    id: 'u_test',
    email: 'test@propsys.local',
    name: 'Test',
    role: 'BUILDING_ADMIN',
    internalRole: 'BUILDING_ADMIN',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('staffRepo', () => {
  it('allows assigned BUILDING_ADMIN to list staff for an assigned building', async () => {
    const adminAssigned = userBase({ id: 'u2' });
    const list = await staffRepo.listForBuilding(adminAssigned, 'b1');
    expect(list.length).toBeGreaterThan(0);
  });

  it('blocks BUILDING_ADMIN without building assignment from listing staff', async () => {
    const adminUnassigned = userBase({ id: 'u7' });
    const list = await staffRepo.listForBuilding(adminUnassigned, 'b1');
    expect(list.length).toBe(0);
  });
});


