import { Building, User } from '@/lib/types';
import { MOCK_PHYSICAL_BUILDINGS, MOCK_PHYSICAL_UNITS } from '@/lib/mocks';
import { filterItemsByTenant } from '@/lib/auth/access-rules';
import { accessScope } from '@/lib/access/access-scope';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const buildingsRepo = {
  async listForUser(user: User): Promise<Building[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ buildings: Building[] }>('/api/v1/physical/buildings', { credentials: 'include' });
      return data.buildings;
    }
    await sleep(300);

    const tenantScoped = filterItemsByTenant(MOCK_PHYSICAL_BUILDINGS, user);
    const tenantScopedUnits = filterItemsByTenant(MOCK_PHYSICAL_UNITS, user);

    const toLegacy = (b: (typeof MOCK_PHYSICAL_BUILDINGS)[number]): Building => ({
      id: b.id,
      clientId: b.clientId,
      name: b.name,
      address: b.address,
      city: b.city,
    });

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped.map(toLegacy);

    if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
      const buildingIds = assignmentsRepo.listBuildingAssignmentsForUser(user).map((a) => a.buildingId);
      return tenantScoped.filter((b) => buildingIds.includes(b.id)).map(toLegacy);
    }

    if (user.internalRole === 'OWNER') {
      const unitIds = assignmentsRepo.listUnitIdsForOwner(user);
      const buildingIds = new Set(tenantScopedUnits.filter((u) => unitIds.includes(u.id)).map((u) => u.buildingId));
      return tenantScoped.filter((b) => buildingIds.has(b.id)).map(toLegacy);
    }

    if (user.internalRole === 'OCCUPANT') {
      const unitIds = assignmentsRepo
        .listUnitAssignmentsForUser(user)
        .filter((a) => a.assignmentType === 'OCCUPANT')
        .map((a) => a.unitId);
      const buildingIds = new Set(tenantScopedUnits.filter((u) => unitIds.includes(u.id)).map((u) => u.buildingId));
      return tenantScoped.filter((b) => buildingIds.has(b.id)).map(toLegacy);
    }

    return [];
  },
};
