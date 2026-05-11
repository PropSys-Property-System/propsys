import { Unit, User } from '@/lib/types';
import { MOCK_PHYSICAL_BUILDINGS, MOCK_PHYSICAL_UNITS, MOCK_USER_UNIT_ASSIGNMENTS } from '@/lib/mocks';
import { canAccessClientRecord, filterItemsByTenant } from '@/lib/auth/access-rules';
import { accessScope } from '@/lib/access/access-scope';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CreateUnitInput = {
  buildingId: string;
  number: string;
  floor?: string;
};

export const unitsRepo = {
  async listForUser(user: User): Promise<Unit[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ units: Unit[] }>('/api/v1/physical/units', { credentials: 'include' });
      return data.units;
    }
    await sleep(300);

    const tenantScoped = filterItemsByTenant(MOCK_PHYSICAL_UNITS, user);

    const isActiveAssignment = (a: { status: string; deletedAt?: string | null }) => a.status === 'ACTIVE' && !a.deletedAt;

    const ownerByUnitId = new Map<string, string>();
    const residentByUnitId = new Map<string, string>();
    for (const a of MOCK_USER_UNIT_ASSIGNMENTS) {
      if (!isActiveAssignment(a)) continue;
      if (!canAccessClientRecord(user, a.clientId)) continue;
      if (a.assignmentType === 'OWNER') ownerByUnitId.set(a.unitId, a.userId);
      if (a.assignmentType === 'OCCUPANT') residentByUnitId.set(a.unitId, a.userId);
    }

    const mapped: Unit[] = tenantScoped.map((u) => ({
      id: u.id,
      clientId: u.clientId,
      buildingId: u.buildingId,
      number: u.number,
      floor: u.floor,
      ownerId: ownerByUnitId.get(u.id),
      residentId: residentByUnitId.get(u.id),
    }));

    if (accessScope(user) === 'PORTFOLIO') return mapped;

    if (accessScope(user) === 'BUILDING') {
      const buildingIds = assignmentsRepo.listBuildingAssignmentsForUser(user).map((a) => a.buildingId);
      if (buildingIds.length === 0) return [];
      return mapped.filter((u) => buildingIds.includes(u.buildingId));
    }

    if (user.internalRole === 'OWNER') {
      const unitIds = assignmentsRepo.listUnitIdsForOwner(user);
      return mapped.filter((u) => unitIds.includes(u.id));
    }

    if (user.internalRole === 'OCCUPANT') {
      const unitIds = assignmentsRepo
        .listUnitAssignmentsForUser(user)
        .filter((a) => a.assignmentType === 'OCCUPANT')
        .map((a) => a.unitId);
      return mapped.filter((u) => unitIds.includes(u.id));
    }

    return [];
  },

  async listForBuilding(user: User, buildingId: string): Promise<Unit[]> {
    const units = await this.listForUser(user);
    return units.filter((unit) => unit.buildingId === buildingId);
  },

  async createForBuilding(user: User, input: CreateUnitInput): Promise<Unit> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ unit: Unit }>('/api/v1/physical/units', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return data.unit;
    }

    await sleep(250);

    if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
      throw new Error('No autorizado');
    }

    const building = MOCK_PHYSICAL_BUILDINGS.find((item) => item.id === input.buildingId && item.status === 'ACTIVE');
    if (!building || !canAccessClientRecord(user, building.clientId)) {
      throw new Error('Edificio no encontrado');
    }

    const visibleUnits = await this.listForUser(user);
    const alreadyExists = visibleUnits.some(
      (unit) => unit.buildingId === input.buildingId && unit.number.trim().toLowerCase() === input.number.trim().toLowerCase()
    );
    if (alreadyExists) {
      throw new Error('Ya existe una unidad con ese numero en este edificio.');
    }

    const now = new Date().toISOString();
    const unit: Unit = {
      id: `unit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      clientId: building.clientId,
      buildingId: input.buildingId,
      number: input.number.trim(),
      floor: input.floor?.trim() ?? '',
    };

    MOCK_PHYSICAL_UNITS.unshift({
      id: unit.id,
      clientId: unit.clientId ?? '',
      buildingId: unit.buildingId,
      number: unit.number,
      floor: unit.floor,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    return unit;
  },
};
