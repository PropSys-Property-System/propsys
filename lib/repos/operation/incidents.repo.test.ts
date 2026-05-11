import { beforeEach, describe, expect, it } from 'vitest';
import { incidentsRepo } from '@/lib/repos/operation/incidents.repo';
import { MOCK_INCIDENTS, MOCK_USER_BUILDING_ASSIGNMENTS, MOCK_USER_UNIT_ASSIGNMENTS } from '@/lib/mocks';
import type { User } from '@/lib/types';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const initialIncidents = clone(MOCK_INCIDENTS);
const initialBuildingAssignments = clone(MOCK_USER_BUILDING_ASSIGNMENTS);
const initialUnitAssignments = clone(MOCK_USER_UNIT_ASSIGNMENTS);

function resetArray<T>(target: T[], snapshot: T[]) {
  target.splice(0, target.length, ...clone(snapshot));
}

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
  resetArray(MOCK_INCIDENTS, initialIncidents);
  resetArray(MOCK_USER_BUILDING_ASSIGNMENTS, initialBuildingAssignments);
  resetArray(MOCK_USER_UNIT_ASSIGNMENTS, initialUnitAssignments);
});

describe('incidentsRepo (V1)', () => {
  it('prevents OCCUPANT from seeing building-level incidents from other buildings in same tenant', async () => {
    const occupant = userBase({ id: 'u5', internalRole: 'OCCUPANT', role: 'TENANT', clientId: 'client_001' });
    const list = await incidentsRepo.listForUser(occupant);
    const ids = new Set(list.map((i) => i.id));
    expect(ids.has('inc-1')).toBe(true);
    expect(ids.has('inc-2')).toBe(true);
    expect(ids.has('inc-3')).toBe(false);
    expect(ids.has('inc-4')).toBe(false);
  });

  it('allows OWNER to see building-level incidents only for buildings where they own a unit', async () => {
    const idx = MOCK_USER_UNIT_ASSIGNMENTS.findIndex((a) => a.userId === 'u4' && a.unitId === 'unit-201' && a.assignmentType === 'OWNER');
    if (idx !== -1) MOCK_USER_UNIT_ASSIGNMENTS.splice(idx, 1);

    const owner = userBase({ id: 'u4', internalRole: 'OWNER', role: 'OWNER', clientId: 'client_001' });
    const list = await incidentsRepo.listForUser(owner);
    const ids = new Set(list.map((i) => i.id));
    expect(ids.has('inc-2')).toBe(true);
    expect(ids.has('inc-3')).toBe(false);
  });

  it('does not change STAFF listing semantics (building-scoped + assigned/reported)', async () => {
    const staff = userBase({ id: 'u3', internalRole: 'STAFF', role: 'STAFF', clientId: 'client_001' });
    const list = await incidentsRepo.listForUser(staff);
    const ids = new Set(list.map((i) => i.id));
    expect(ids.has('inc-1')).toBe(true);
    expect(ids.has('inc-2')).toBe(true);
    expect(ids.has('inc-3')).toBe(false);
  });
});

