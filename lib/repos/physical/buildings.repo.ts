import { Building, User } from '@/lib/types';
import { MOCK_PHYSICAL_BUILDINGS, MOCK_PHYSICAL_COMMON_AREAS, MOCK_PHYSICAL_UNITS } from '@/lib/mocks';
import { filterItemsByTenant } from '@/lib/auth/access-rules';
import { accessScope } from '@/lib/access/access-scope';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CreateBuildingInput = {
  clientId?: string;
  name: string;
  address: string;
  city: string;
};

function toLegacyBuilding(b: (typeof MOCK_PHYSICAL_BUILDINGS)[number]): Building {
  return {
    id: b.id,
    clientId: b.clientId,
    name: b.name,
    address: b.address,
    city: b.city,
  };
}

export const buildingsRepo = {
  async listForUser(user: User): Promise<Building[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ buildings: Building[] }>('/api/v1/physical/buildings', { credentials: 'include' });
      return data.buildings;
    }
    await sleep(300);

    const tenantScoped = filterItemsByTenant(MOCK_PHYSICAL_BUILDINGS, user).filter((b) => b.status === 'ACTIVE');
    const tenantScopedUnits = filterItemsByTenant(MOCK_PHYSICAL_UNITS, user);

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped.map(toLegacyBuilding);

    if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
      const buildingIds = assignmentsRepo.listBuildingAssignmentsForUser(user).map((a) => a.buildingId);
      return tenantScoped.filter((b) => buildingIds.includes(b.id)).map(toLegacyBuilding);
    }

    if (user.internalRole === 'OWNER') {
      const unitIds = assignmentsRepo.listUnitIdsForOwner(user);
      const buildingIds = new Set(tenantScopedUnits.filter((u) => unitIds.includes(u.id)).map((u) => u.buildingId));
      return tenantScoped.filter((b) => buildingIds.has(b.id)).map(toLegacyBuilding);
    }

    if (user.internalRole === 'OCCUPANT') {
      const unitIds = assignmentsRepo
        .listUnitAssignmentsForUser(user)
        .filter((a) => a.assignmentType === 'OCCUPANT')
        .map((a) => a.unitId);
      const buildingIds = new Set(tenantScopedUnits.filter((u) => unitIds.includes(u.id)).map((u) => u.buildingId));
      return tenantScoped.filter((b) => buildingIds.has(b.id)).map(toLegacyBuilding);
    }

    return [];
  },

  async listArchivedForUser(user: User): Promise<Building[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ buildings: Building[] }>('/api/v1/physical/buildings?status=ARCHIVED', { credentials: 'include' });
      return data.buildings;
    }

    await sleep(300);

    if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') return [];
    const tenantScoped = filterItemsByTenant(MOCK_PHYSICAL_BUILDINGS, user).filter((b) => b.status === 'ARCHIVED');
    return tenantScoped.map(toLegacyBuilding);
  },

  async createForUser(user: User, input: CreateBuildingInput): Promise<Building> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ building: Building }>('/api/v1/physical/buildings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return data.building;
    }

    await sleep(250);

    const targetClientId = user.internalRole === 'ROOT_ADMIN' ? input.clientId : user.clientId;
    if (!targetClientId) {
      throw new Error('Selecciona un cliente para crear el edificio.');
    }

    if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
      throw new Error('No autorizado');
    }

    if (user.internalRole === 'CLIENT_MANAGER' && user.clientId !== targetClientId) {
      throw new Error('No autorizado');
    }

    const normalizedName = input.name.trim().toLowerCase();
    const alreadyExists = MOCK_PHYSICAL_BUILDINGS.some(
      (building) => building.status === 'ACTIVE' && building.clientId === targetClientId && building.name.trim().toLowerCase() === normalizedName
    );
    if (alreadyExists) {
      throw new Error('Ya existe un edificio con ese nombre para este cliente.');
    }

    const now = new Date().toISOString();
    const building: Building = {
      id: `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      clientId: targetClientId,
      name: input.name.trim(),
      address: input.address.trim(),
      city: input.city.trim(),
    };

    MOCK_PHYSICAL_BUILDINGS.unshift({
      ...building,
      clientId: targetClientId,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    return building;
  },

  async archiveForUser(user: User, buildingId: string): Promise<Building> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ building: Building }>(`/api/v1/physical/buildings/${buildingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return data.building;
    }

    await sleep(250);

    if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
      throw new Error('No autorizado');
    }

    const building = MOCK_PHYSICAL_BUILDINGS.find((item) => item.id === buildingId && item.status === 'ACTIVE');
    if (!building) throw new Error('Edificio no encontrado');
    if (user.internalRole === 'CLIENT_MANAGER' && user.clientId !== building.clientId) {
      throw new Error('Edificio no encontrado');
    }

    const hasActiveDependencies =
      MOCK_PHYSICAL_UNITS.some((unit) => unit.buildingId === buildingId && unit.status === 'ACTIVE') ||
      MOCK_PHYSICAL_COMMON_AREAS.some((area) => area.buildingId === buildingId && area.status === 'ACTIVE');
    if (hasActiveDependencies) {
      throw new Error('No puedes archivar un edificio con datos asociados activos.');
    }

    building.status = 'ARCHIVED';
    building.updatedAt = new Date().toISOString();

    return {
      id: building.id,
      clientId: building.clientId,
      name: building.name,
      address: building.address,
      city: building.city,
    };
  },

  async restoreForUser(user: User, buildingId: string): Promise<Building> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ building: Building }>(`/api/v1/physical/buildings/${buildingId}`, {
        method: 'PATCH',
        credentials: 'include',
      });
      return data.building;
    }

    await sleep(250);

    if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') {
      throw new Error('No autorizado');
    }

    const building = MOCK_PHYSICAL_BUILDINGS.find((item) => item.id === buildingId && item.status === 'ARCHIVED');
    if (!building) throw new Error('Edificio no encontrado');
    if (user.internalRole === 'CLIENT_MANAGER' && user.clientId !== building.clientId) {
      throw new Error('Edificio no encontrado');
    }

    const normalizedName = building.name.trim().toLowerCase();
    const alreadyExists = MOCK_PHYSICAL_BUILDINGS.some(
      (item) => item.id !== building.id && item.status === 'ACTIVE' && item.clientId === building.clientId && item.name.trim().toLowerCase() === normalizedName
    );
    if (alreadyExists) {
      throw new Error('Ya existe un edificio activo con ese nombre para este cliente.');
    }

    building.status = 'ACTIVE';
    building.updatedAt = new Date().toISOString();

    return toLegacyBuilding(building);
  },
};
