import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';
import { clearAssignmentsCache, setAssignmentsCache } from '@/lib/access/assignments-cache';
import type { User } from '@/lib/types';

const originalDataMode = process.env.NEXT_PUBLIC_DATA_MODE;

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

beforeEach(() => {
  process.env.NEXT_PUBLIC_DATA_MODE = 'db';
});

afterEach(() => {
  clearAssignmentsCache('u_scope');
  if (originalDataMode === undefined) {
    delete process.env.NEXT_PUBLIC_DATA_MODE;
  } else {
    process.env.NEXT_PUBLIC_DATA_MODE = originalDataMode;
  }
});

describe('assignmentsRepo tenant scope', () => {
  it('does not bypass tenant scope in cached unit assignments for non-root platform users', () => {
    setAssignmentsCache('u_scope', {
      buildingAssignments: [],
      unitAssignments: [
        {
          id: 'uua_1',
          client_id: 'client_001',
          user_id: 'u_scope',
          unit_id: 'unit-101',
          assignment_type: 'OWNER',
          status: 'ACTIVE',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
          deleted_at: null,
        },
        {
          id: 'uua_2',
          client_id: 'client_002',
          user_id: 'u_scope',
          unit_id: 'unit-301',
          assignment_type: 'OWNER',
          status: 'ACTIVE',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
          deleted_at: null,
        },
      ],
    });

    const platformManager = userBase({
      id: 'u_scope',
      internalRole: 'CLIENT_MANAGER',
      role: 'MANAGER',
      scope: 'platform',
      clientId: null,
    });

    expect(assignmentsRepo.listUnitAssignmentsForUser(platformManager)).toEqual([]);
  });

  it('still allows ROOT_ADMIN platform users to read cached assignments', () => {
    setAssignmentsCache('u_scope', {
      buildingAssignments: [
        {
          id: 'uba_1',
          client_id: 'client_001',
          user_id: 'u_scope',
          building_id: 'b1',
          status: 'ACTIVE',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
          deleted_at: null,
        },
      ],
      unitAssignments: [
        {
          id: 'uua_1',
          client_id: 'client_001',
          user_id: 'u_scope',
          unit_id: 'unit-101',
          assignment_type: 'OWNER',
          status: 'ACTIVE',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
          deleted_at: null,
        },
      ],
    });

    const root = userBase({
      id: 'u_scope',
      internalRole: 'ROOT_ADMIN',
      role: 'MANAGER',
      scope: 'platform',
      clientId: null,
    });

    expect(assignmentsRepo.listBuildingAssignmentsForUser(root)).toHaveLength(1);
    expect(assignmentsRepo.listUnitAssignmentsForUser(root)).toHaveLength(1);
  });

  it('filters cached assignments by client for client-scoped users', () => {
    setAssignmentsCache('u_scope', {
      buildingAssignments: [
        {
          id: 'uba_1',
          client_id: 'client_001',
          user_id: 'u_scope',
          building_id: 'b1',
          status: 'ACTIVE',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
          deleted_at: null,
        },
        {
          id: 'uba_2',
          client_id: 'client_002',
          user_id: 'u_scope',
          building_id: 'b3',
          status: 'ACTIVE',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
          deleted_at: null,
        },
      ],
      unitAssignments: [],
    });

    const manager = userBase({
      id: 'u_scope',
      internalRole: 'CLIENT_MANAGER',
      role: 'MANAGER',
      scope: 'client',
      clientId: 'client_001',
    });

    const assignments = assignmentsRepo.listBuildingAssignmentsForUser(manager);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]?.clientId).toBe('client_001');
  });
});
