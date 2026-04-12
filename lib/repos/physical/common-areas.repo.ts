import { CommonArea, User } from '@/lib/types';
import { MOCK_PHYSICAL_BUILDINGS, MOCK_PHYSICAL_COMMON_AREAS, MOCK_PHYSICAL_UNITS } from '@/lib/mocks';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const commonAreasRepo = {
  async listForBuilding(user: User, buildingId: string): Promise<CommonArea[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ areas: CommonArea[] }>(
        `/api/v1/physical/common-areas?buildingId=${encodeURIComponent(buildingId)}`,
        { credentials: 'include' }
      );
      return data.areas;
    }
    await sleep(250);

    const toLegacy = (a: (typeof MOCK_PHYSICAL_COMMON_AREAS)[number]): CommonArea => ({
      id: a.id,
      clientId: a.clientId,
      buildingId: a.buildingId,
      name: a.name,
      capacity: a.capacity,
      requiresApproval: a.requiresApproval,
    });

    if (user.scope === 'platform') {
      return MOCK_PHYSICAL_COMMON_AREAS.filter((a) => a.buildingId === buildingId && a.status === 'ACTIVE' && !a.deletedAt).map(toLegacy);
    }

    if (!user.clientId) return [];

    const building = MOCK_PHYSICAL_BUILDINGS.find((b) => b.id === buildingId);
    if (!building || building.clientId !== user.clientId) return [];

    if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
      if (!assignmentsRepo.isAssignedToBuilding(user, buildingId)) return [];
    }
    if (user.internalRole === 'OWNER') {
      const unitIds = assignmentsRepo.listUnitIdsForOwner(user);
      const ownsInBuilding = MOCK_PHYSICAL_UNITS.some((u) => u.clientId === user.clientId && u.buildingId === buildingId && unitIds.includes(u.id));
      if (!ownsInBuilding) return [];
    }
    if (user.internalRole === 'OCCUPANT') {
      const unitIds = assignmentsRepo
        .listUnitAssignmentsForUser(user)
        .filter((a) => a.assignmentType === 'OCCUPANT')
        .map((a) => a.unitId);
      const livesInBuilding = MOCK_PHYSICAL_UNITS.some((u) => u.clientId === user.clientId && u.buildingId === buildingId && unitIds.includes(u.id));
      if (!livesInBuilding) return [];
    }

    return MOCK_PHYSICAL_COMMON_AREAS.filter((a) => a.buildingId === buildingId && a.clientId === user.clientId && a.status === 'ACTIVE' && !a.deletedAt).map(toLegacy);
  },

  async updateRequiresApprovalForUser(user: User, id: string, requiresApproval: boolean): Promise<CommonArea> {
    if (isDbMode()) {
      const res = await fetch('/api/v1/physical/common-areas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, requiresApproval }),
      });
      const data = (await res.json().catch(() => null)) as { area?: CommonArea; error?: string } | null;
      if (!res.ok || !data?.area) throw new Error(data?.error || 'No autorizado');
      return data.area;
    }
    await sleep(200);

    if (user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
      throw new Error('No autorizado');
    }

    const idx = MOCK_PHYSICAL_COMMON_AREAS.findIndex((area) => area.id === id && area.status === 'ACTIVE' && !area.deletedAt);
    if (idx === -1) throw new Error('Área común no encontrada');

    const current = MOCK_PHYSICAL_COMMON_AREAS[idx];
    if (user.scope !== 'platform' && current.clientId !== user.clientId) {
      throw new Error('Área común no encontrada');
    }

    const updated = {
      ...current,
      requiresApproval,
      updatedAt: new Date().toISOString(),
    };
    MOCK_PHYSICAL_COMMON_AREAS[idx] = updated;

    return {
      id: updated.id,
      clientId: updated.clientId,
      buildingId: updated.buildingId,
      name: updated.name,
      capacity: updated.capacity,
      requiresApproval: updated.requiresApproval,
    };
  },
};

