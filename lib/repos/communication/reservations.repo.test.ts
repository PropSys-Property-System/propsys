import { beforeEach, describe, expect, it } from 'vitest';
import { reservationsRepo } from '@/lib/repos/communication/reservations.repo';
import {
  MOCK_RESERVATION_ENTITIES,
  MOCK_USER_BUILDING_ASSIGNMENTS,
  MOCK_USER_UNIT_ASSIGNMENTS,
} from '@/lib/mocks';
import type { ReservationEntity, User } from '@/lib/types';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const initialReservations = clone(MOCK_RESERVATION_ENTITIES);
const initialBuildingAssignments = clone(MOCK_USER_BUILDING_ASSIGNMENTS);
const initialUnitAssignments = clone(MOCK_USER_UNIT_ASSIGNMENTS);

function resetArray<T>(target: T[], snapshot: T[]) {
  target.splice(0, target.length, ...clone(snapshot));
}

function futureRange(daysFromNow: number, startHour = 18, durationHours = 1) {
  const start = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  start.setUTCHours(startHour, 0, 0, 0);
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function reservationFixture(overrides: Partial<ReservationEntity>): ReservationEntity {
  const now = new Date().toISOString();
  return {
    id: 'resv-test',
    clientId: 'client_001',
    buildingId: 'b1',
    unitId: 'unit-101',
    commonAreaId: 'ca1',
    createdByUserId: 'u4',
    status: 'APPROVED',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
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
  resetArray(MOCK_RESERVATION_ENTITIES, initialReservations);
  resetArray(MOCK_USER_BUILDING_ASSIGNMENTS, initialBuildingAssignments);
  resetArray(MOCK_USER_UNIT_ASSIGNMENTS, initialUnitAssignments);
});

describe('reservationsRepo (V1)', () => {
  it('applies multi-tenant isolation for CLIENT_MANAGER (no cross-client)', async () => {
    const manager = userBase({ id: 'u1', internalRole: 'CLIENT_MANAGER', role: 'MANAGER', clientId: 'client_001' });
    const list = await reservationsRepo.listForUser(manager);
    const ids = new Set(list.map((r) => r.id));
    expect(ids.has('resv-1')).toBe(true);
    expect(ids.has('resv-2')).toBe(true);
    expect(ids.has('resv-4')).toBe(true);
    expect(ids.has('resv-3')).toBe(false);
  });

  it('supports BUILDING_ADMIN with multiple assigned buildings (sees reservations for all assigned buildings)', async () => {
    const admin = userBase({ id: 'u2', internalRole: 'BUILDING_ADMIN', role: 'BUILDING_ADMIN', clientId: 'client_001' });
    const list = await reservationsRepo.listForUser(admin);
    const buildingIds = new Set(list.map((r) => r.buildingId));
    expect(buildingIds.has('b1')).toBe(true);
    expect(buildingIds.has('b2')).toBe(true);
    expect(buildingIds.has('b3')).toBe(false);
  });

  it('supports OWNER with multiple units across buildings (sees reservations for owned units)', async () => {
    const owner = userBase({ id: 'u4', internalRole: 'OWNER', role: 'OWNER', clientId: 'client_001' });
    const list = await reservationsRepo.listForUser(owner);
    const ids = new Set(list.map((r) => r.id));
    expect(ids.has('resv-1')).toBe(true);
    expect(ids.has('resv-2')).toBe(true);
    expect(ids.has('resv-4')).toBe(true);
  });

  it('blocks OCCUPANT from creating reservations for a unit without an OCCUPANT assignment', async () => {
    const occupant = userBase({ id: 'u5', internalRole: 'OCCUPANT', role: 'TENANT', clientId: 'client_001' });
    await expect(
      reservationsRepo.createForUser(occupant, {
        buildingId: 'b1',
        unitId: 'unit-101',
        commonAreaId: 'ca1',
        startAt: '2026-04-10T18:00:00.000Z',
        endAt: '2026-04-10T19:00:00.000Z',
      })
    ).rejects.toThrow('No autorizado');
  });

  it('validates commonAreaId belongs to buildingId (rejects cross-building common area)', async () => {
    const owner = userBase({ id: 'u4', internalRole: 'OWNER', role: 'OWNER', clientId: 'client_001' });
    await expect(
      reservationsRepo.createForUser(owner, {
        buildingId: 'b1',
        unitId: 'unit-101',
        commonAreaId: 'ca4',
        startAt: '2026-04-10T18:00:00.000Z',
        endAt: '2026-04-10T19:00:00.000Z',
      })
    ).rejects.toThrow('No autorizado');
  });

  it('rejects overlapping reservations for the same common area', async () => {
    const owner = userBase({ id: 'u4', internalRole: 'OWNER', role: 'OWNER', clientId: 'client_001' });
    const existing = futureRange(10, 19, 3);
    const overlap = futureRange(10, 20, 1);
    MOCK_RESERVATION_ENTITIES.unshift(
      reservationFixture({
        id: 'resv-overlap-future',
        ...existing,
      })
    );

    await expect(
      reservationsRepo.createForUser(owner, {
        buildingId: 'b1',
        unitId: 'unit-101',
        commonAreaId: 'ca1',
        ...overlap,
      })
    ).rejects.toThrow('Ese horario ya está reservado.');
  });

  it('creates an APPROVED reservation when the common area does not require approval', async () => {
    const owner = userBase({ id: 'u4', internalRole: 'OWNER', role: 'OWNER', clientId: 'client_001' });
    const range = futureRange(11);
    const created = await reservationsRepo.createForUser(owner, {
      buildingId: 'b1',
      unitId: 'unit-101',
      commonAreaId: 'ca3',
      ...range,
    });
    expect(created.clientId).toBe('client_001');
    expect(created.status).toBe('APPROVED');
    expect(MOCK_RESERVATION_ENTITIES[0].id).toBe(created.id);
  });

  it('allows BUILDING_ADMIN to approve/reject REQUESTED reservations in assigned buildings', async () => {
    const admin = userBase({ id: 'u2', internalRole: 'BUILDING_ADMIN', role: 'BUILDING_ADMIN', clientId: 'client_001' });

    const requested: ReservationEntity = {
      id: 'resv-test-req',
      clientId: 'client_001',
      buildingId: 'b2',
      unitId: 'unit-201',
      commonAreaId: 'ca4',
      createdByUserId: 'u4',
      startAt: '2026-04-12T18:00:00.000Z',
      endAt: '2026-04-12T19:00:00.000Z',
      status: 'REQUESTED',
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    };
    MOCK_RESERVATION_ENTITIES.unshift(requested);

    const approved = await reservationsRepo.approveForUser(admin, 'resv-test-req');
    expect(approved?.status).toBe('APPROVED');

    MOCK_RESERVATION_ENTITIES[0] = { ...MOCK_RESERVATION_ENTITIES[0], status: 'REQUESTED' };
    const rejected = await reservationsRepo.rejectForUser(admin, 'resv-test-req');
    expect(rejected?.status).toBe('REJECTED');
  });

  it('enforces cancellation rules for OWNER/OCCUPANT and BUILDING_ADMIN', async () => {
    const owner = userBase({ id: 'u4', internalRole: 'OWNER', role: 'OWNER', clientId: 'client_001' });
    const occupant = userBase({ id: 'u5', internalRole: 'OCCUPANT', role: 'TENANT', clientId: 'client_001' });
    const admin = userBase({ id: 'u2', internalRole: 'BUILDING_ADMIN', role: 'BUILDING_ADMIN', clientId: 'client_001' });
    MOCK_RESERVATION_ENTITIES.unshift(
      reservationFixture({
        id: 'resv-owner-cancel-future',
        ...futureRange(12, 19, 2),
      }),
      reservationFixture({
        id: 'resv-admin-cancel-future',
        buildingId: 'b2',
        unitId: 'unit-201',
        commonAreaId: 'ca4',
        ...futureRange(13, 19, 2),
      })
    );

    const cancelledByOwner = await reservationsRepo.cancelForUser(owner, 'resv-owner-cancel-future');
    expect(cancelledByOwner?.status).toBe('CANCELLED');

    await expect(reservationsRepo.cancelForUser(occupant, 'resv-owner-cancel-future')).rejects.toThrow('No autorizado');

    const cancelledByAdmin = await reservationsRepo.cancelForUser(admin, 'resv-admin-cancel-future');
    expect(cancelledByAdmin?.status).toBe('CANCELLED');
  });
});


