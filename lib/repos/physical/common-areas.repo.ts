import { CommonArea, User } from '@/lib/types';
import { MOCK_PHYSICAL_BUILDINGS, MOCK_PHYSICAL_COMMON_AREAS, MOCK_PHYSICAL_UNITS } from '@/lib/mocks';
import { canAccessClientRecord } from '@/lib/auth/access-rules';
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

    const building = MOCK_PHYSICAL_BUILDINGS.find((b) => b.id === buildingId);
    if (!building || !canAccessClientRecord(user, building.clientId)) return [];

    if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
      if (!assignmentsRepo.isAssignedToBuilding(user, buildingId)) return [];
    }
    if (user.internalRole === 'OWNER') {
      const unitIds = assignmentsRepo.listUnitIdsForOwner(user);
      const ownsInBuilding = MOCK_PHYSICAL_UNITS.some((u) => canAccessClientRecord(user, u.clientId) && u.buildingId === buildingId && unitIds.includes(u.id));
      if (!ownsInBuilding) return [];
    }
    if (user.internalRole === 'OCCUPANT') {
      const unitIds = assignmentsRepo
        .listUnitAssignmentsForUser(user)
        .filter((a) => a.assignmentType === 'OCCUPANT')
        .map((a) => a.unitId);
      const livesInBuilding = MOCK_PHYSICAL_UNITS.some((u) => canAccessClientRecord(user, u.clientId) && u.buildingId === buildingId && unitIds.includes(u.id));
      if (!livesInBuilding) return [];
    }

    return MOCK_PHYSICAL_COMMON_AREAS
      .filter((a) => a.buildingId === buildingId && canAccessClientRecord(user, a.clientId) && a.status === 'ACTIVE' && !a.deletedAt)
      .map(toLegacy);
  },

  async listArchivedForBuilding(user: User, buildingId: string): Promise<CommonArea[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ areas: CommonArea[] }>(
        `/api/v1/physical/common-areas?buildingId=${encodeURIComponent(buildingId)}&status=ARCHIVED`,
        { credentials: 'include' }
      );
      return data.areas;
    }
    await sleep(250);
    const building = MOCK_PHYSICAL_BUILDINGS.find((b) => b.id === buildingId);
    if (!building || !canAccessClientRecord(user, building.clientId)) return [];
    return MOCK_PHYSICAL_COMMON_AREAS.filter((a) => a.buildingId === buildingId && canAccessClientRecord(user, a.clientId) && a.status === 'ARCHIVED' && !a.deletedAt).map((a) => ({
      id: a.id,
      clientId: a.clientId,
      buildingId: a.buildingId,
      name: a.name,
      capacity: a.capacity,
      requiresApproval: a.requiresApproval,
    }));
  },

  async createForUser(
    user: User,
    input: { buildingId: string; name: string; capacity: number; requiresApproval: boolean }
  ): Promise<CommonArea> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ area: CommonArea }>('/api/v1/physical/common-areas', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      return data.area;
    }
    await sleep(200);

    if (user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
      throw new Error('No autorizado');
    }
    const building = MOCK_PHYSICAL_BUILDINGS.find((b) => b.id === input.buildingId && b.status === 'ACTIVE');
    if (!building || !canAccessClientRecord(user, building.clientId)) throw new Error('Edificio no encontrado');

    const duplicate = MOCK_PHYSICAL_COMMON_AREAS.find(
      (area) =>
        area.buildingId === input.buildingId &&
        area.status === 'ACTIVE' &&
        !area.deletedAt &&
        area.name.trim().toLowerCase() === input.name.trim().toLowerCase()
    );
    if (duplicate) throw new Error('Ya existe un area comun activa con ese nombre.');

    const now = new Date().toISOString();
    const area = {
      id: `ca_${Date.now()}_${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
      clientId: building.clientId,
      buildingId: input.buildingId,
      name: input.name.trim(),
      capacity: Math.floor(input.capacity),
      requiresApproval: input.requiresApproval,
      status: 'ACTIVE' as const,
      createdAt: now,
      updatedAt: now,
    };
    MOCK_PHYSICAL_COMMON_AREAS.unshift(area);
    return {
      id: area.id,
      clientId: area.clientId,
      buildingId: area.buildingId,
      name: area.name,
      capacity: area.capacity,
      requiresApproval: area.requiresApproval,
    };
  },

  async updateForUser(
    user: User,
    input: { id: string; name: string; capacity: number; requiresApproval: boolean }
  ): Promise<CommonArea> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ area: CommonArea }>('/api/v1/physical/common-areas', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      return data.area;
    }
    await sleep(200);
    if (user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') throw new Error('No autorizado');
    const idx = MOCK_PHYSICAL_COMMON_AREAS.findIndex((area) => area.id === input.id && area.status === 'ACTIVE' && !area.deletedAt);
    if (idx === -1) throw new Error('Área común no encontrada');
    const current = MOCK_PHYSICAL_COMMON_AREAS[idx];
    if (!canAccessClientRecord(user, current.clientId)) throw new Error('Área común no encontrada');
    const duplicate = MOCK_PHYSICAL_COMMON_AREAS.find(
      (area) =>
        area.id !== input.id &&
        area.buildingId === current.buildingId &&
        area.status === 'ACTIVE' &&
        !area.deletedAt &&
        area.name.trim().toLowerCase() === input.name.trim().toLowerCase()
    );
    if (duplicate) throw new Error('Ya existe un area comun activa con ese nombre.');
    const updated = {
      ...current,
      name: input.name.trim(),
      capacity: Math.floor(input.capacity),
      requiresApproval: input.requiresApproval,
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
    if (!canAccessClientRecord(user, current.clientId)) {
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

  async archiveForUser(user: User, id: string): Promise<CommonArea> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ area: CommonArea }>('/api/v1/physical/common-areas', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      return data.area;
    }
    await sleep(200);
    if (user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') throw new Error('No autorizado');
    const idx = MOCK_PHYSICAL_COMMON_AREAS.findIndex((area) => area.id === id && area.status === 'ACTIVE' && !area.deletedAt);
    if (idx === -1) throw new Error('Área común no encontrada');
    const current = MOCK_PHYSICAL_COMMON_AREAS[idx];
    if (!canAccessClientRecord(user, current.clientId)) throw new Error('Área común no encontrada');
    MOCK_PHYSICAL_COMMON_AREAS[idx] = { ...current, status: 'ARCHIVED', updatedAt: new Date().toISOString() };
    const updated = MOCK_PHYSICAL_COMMON_AREAS[idx];
    return {
      id: updated.id,
      clientId: updated.clientId,
      buildingId: updated.buildingId,
      name: updated.name,
      capacity: updated.capacity,
      requiresApproval: updated.requiresApproval,
    };
  },

  async restoreForUser(user: User, id: string): Promise<CommonArea> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ area: CommonArea }>('/api/v1/physical/common-areas', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, restore: true }),
      });
      return data.area;
    }
    await sleep(200);
    if (user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') throw new Error('No autorizado');
    const idx = MOCK_PHYSICAL_COMMON_AREAS.findIndex((area) => area.id === id && area.status === 'ARCHIVED' && !area.deletedAt);
    if (idx === -1) throw new Error('Área común archivada no encontrada');
    const current = MOCK_PHYSICAL_COMMON_AREAS[idx];
    if (!canAccessClientRecord(user, current.clientId)) throw new Error('Área común archivada no encontrada');
    const duplicate = MOCK_PHYSICAL_COMMON_AREAS.find(
      (area) =>
        area.id !== id &&
        area.buildingId === current.buildingId &&
        area.status === 'ACTIVE' &&
        !area.deletedAt &&
        area.name.trim().toLowerCase() === current.name.trim().toLowerCase()
    );
    if (duplicate) throw new Error('Ya existe un area comun activa con ese nombre.');
    MOCK_PHYSICAL_COMMON_AREAS[idx] = { ...current, status: 'ACTIVE', updatedAt: new Date().toISOString() };
    const updated = MOCK_PHYSICAL_COMMON_AREAS[idx];
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
