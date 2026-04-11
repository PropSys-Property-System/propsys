import { Reservation, ReservationEntity, User } from '@/lib/types';
import { MOCK_RESERVATION_ENTITIES } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';
import { auditService } from '@/lib/audit/audit-service';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { commonAreasRepo } from '@/lib/repos/physical/common-areas.repo';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toLegacyReservation(r: ReservationEntity): Reservation {
  return {
    id: r.id,
    buildingId: r.buildingId,
    unitId: r.unitId,
    commonAreaId: r.commonAreaId,
    createdByUserId: r.createdByUserId,
    startAt: r.startAt,
    endAt: r.endAt,
    status: r.status,
  };
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

function isOccupantOfUnit(user: User, unitId: string) {
  return assignmentsRepo.listUnitAssignmentsForUser(user).some((a) => a.assignmentType === 'OCCUPANT' && a.unitId === unitId);
}

export const reservationsRepo = {
  async listForUser(user: User): Promise<Reservation[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ reservations: Reservation[] }>('/api/v1/reservations', { credentials: 'include' });
      return data.reservations;
    }
    await sleep(350);

    const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);
    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_RESERVATION_ENTITIES
        : user.clientId
          ? MOCK_RESERVATION_ENTITIES.filter((r) => r.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') {
      if (user.scope === 'platform') return tenantScoped.map(toLegacyReservation);
      return tenantScoped.filter((r) => buildingIds.includes(r.buildingId)).map(toLegacyReservation);
    }

    if (accessScope(user) === 'BUILDING') {
      if (buildingIds.length === 0) return [];
      return tenantScoped.filter((r) => buildingIds.includes(r.buildingId)).map(toLegacyReservation);
    }

    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    return tenantScoped.filter((r) => unitIds.includes(r.unitId)).map(toLegacyReservation);
  },

  async createForUser(
    user: User,
    input: Pick<ReservationEntity, 'buildingId' | 'unitId' | 'commonAreaId' | 'startAt' | 'endAt'>
  ): Promise<ReservationEntity> {
    if (isDbMode()) {
      const res = await fetch('/api/v1/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { reservation?: ReservationEntity; error?: string } | null;
      if (!res.ok || !data?.reservation) throw new Error(data?.error || 'No autorizado');
      return data.reservation;
    }
    await sleep(300);

    if (user.internalRole !== 'OWNER' && user.internalRole !== 'OCCUPANT') {
      throw new Error('No autorizado');
    }
    if (user.scope !== 'platform' && !user.clientId) {
      throw new Error('No autorizado');
    }

    if (user.internalRole === 'OWNER') {
      if (!assignmentsRepo.isOwnerOfUnit(user, input.unitId)) throw new Error('No autorizado');
    } else {
      if (!isOccupantOfUnit(user, input.unitId)) throw new Error('No autorizado');
    }

    const units = await unitsRepo.listForUser(user);
    const unit = units.find((u) => u.id === input.unitId);
    if (!unit) throw new Error('No autorizado');
    if (unit.buildingId !== input.buildingId) throw new Error('No autorizado');

    const areas = await commonAreasRepo.listForBuilding(user, input.buildingId);
    const area = areas.find((a) => a.id === input.commonAreaId);
    if (!area) throw new Error('No autorizado');

    const start = new Date(input.startAt);
    const end = new Date(input.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error('Fecha inválida');
    if (start >= end) throw new Error('La hora de inicio debe ser anterior al término.');

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_RESERVATION_ENTITIES
        : user.clientId
          ? MOCK_RESERVATION_ENTITIES.filter((r) => r.clientId === user.clientId)
          : [];

    const active = tenantScoped.filter((r) => r.buildingId === input.buildingId && r.commonAreaId === input.commonAreaId && r.status !== 'CANCELLED' && r.status !== 'REJECTED' && !r.deletedAt);
    const hasOverlap = active.some((r) => overlaps(start, end, new Date(r.startAt), new Date(r.endAt)));
    if (hasOverlap) throw new Error('Ese horario ya está reservado.');

    const now = new Date().toISOString();
    const status: ReservationEntity['status'] = area.requiresApproval ? 'REQUESTED' : 'APPROVED';
    const entity: ReservationEntity = {
      id: `resv_${Date.now()}`,
      clientId: user.scope === 'platform' ? (user.clientId ?? 'client_001') : user.clientId!,
      buildingId: input.buildingId,
      unitId: input.unitId,
      commonAreaId: input.commonAreaId,
      createdByUserId: user.id,
      startAt: input.startAt,
      endAt: input.endAt,
      status,
      createdAt: now,
      updatedAt: now,
    };

    MOCK_RESERVATION_ENTITIES.unshift(entity);
    auditService.logAction({
      userId: user.id,
      clientId: entity.clientId,
      action: 'CREATE',
      entity: 'Reservation',
      entityId: entity.id,
      newData: entity,
      metadata: { buildingId: entity.buildingId, unitId: entity.unitId, commonAreaId: entity.commonAreaId },
    });

    return entity;
  },

  async cancelForUser(user: User, id: string): Promise<ReservationEntity | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'CANCEL' }),
      });
      if (res.status === 404) return null;
      const data = (await res.json().catch(() => null)) as { reservation?: ReservationEntity | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return data?.reservation ?? null;
    }
    await sleep(250);
    const idx = MOCK_RESERVATION_ENTITIES.findIndex((x) => x.id === id);
    if (idx === -1) return null;

    const current = MOCK_RESERVATION_ENTITIES[idx];
    if (user.scope !== 'platform' && user.clientId !== current.clientId) return null;

    if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
      if (current.createdByUserId !== user.id) throw new Error('No autorizado');
      if (user.internalRole === 'OWNER') {
        if (!assignmentsRepo.isOwnerOfUnit(user, current.unitId)) throw new Error('No autorizado');
      } else {
        if (!isOccupantOfUnit(user, current.unitId)) throw new Error('No autorizado');
      }
    } else if (user.internalRole === 'BUILDING_ADMIN') {
      if (!assignmentsRepo.isAssignedToBuilding(user, current.buildingId)) throw new Error('No autorizado');
    } else {
      throw new Error('No autorizado');
    }

    if (current.status === 'CANCELLED') return current;

    const now = new Date().toISOString();
    const updated: ReservationEntity = { ...current, status: 'CANCELLED', cancelledAt: now, updatedAt: now };
    MOCK_RESERVATION_ENTITIES[idx] = updated;

    auditService.logAction({
      userId: user.id,
      clientId: updated.clientId,
      action: 'UPDATE',
      entity: 'Reservation',
      entityId: updated.id,
      oldData: current,
      newData: updated,
      metadata: { buildingId: updated.buildingId, unitId: updated.unitId, commonAreaId: updated.commonAreaId },
    });

    return updated;
  },

  async approveForUser(user: User, id: string): Promise<ReservationEntity | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      if (res.status === 404) return null;
      const data = (await res.json().catch(() => null)) as { reservation?: ReservationEntity | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return data?.reservation ?? null;
    }
    await sleep(250);
    const idx = MOCK_RESERVATION_ENTITIES.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    const current = MOCK_RESERVATION_ENTITIES[idx];
    if (user.scope !== 'platform' && user.clientId !== current.clientId) return null;
    if (user.internalRole !== 'BUILDING_ADMIN') throw new Error('No autorizado');
    if (!assignmentsRepo.isAssignedToBuilding(user, current.buildingId)) throw new Error('No autorizado');
    if (current.status !== 'REQUESTED') throw new Error('No autorizado');

    const now = new Date().toISOString();
    const updated: ReservationEntity = { ...current, status: 'APPROVED', updatedAt: now };
    MOCK_RESERVATION_ENTITIES[idx] = updated;

    auditService.logAction({
      userId: user.id,
      clientId: updated.clientId,
      action: 'UPDATE',
      entity: 'Reservation',
      entityId: updated.id,
      oldData: current,
      newData: updated,
      metadata: { buildingId: updated.buildingId, unitId: updated.unitId, commonAreaId: updated.commonAreaId },
    });

    return updated;
  },

  async rejectForUser(user: User, id: string): Promise<ReservationEntity | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'REJECT' }),
      });
      if (res.status === 404) return null;
      const data = (await res.json().catch(() => null)) as { reservation?: ReservationEntity | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return data?.reservation ?? null;
    }
    await sleep(250);
    const idx = MOCK_RESERVATION_ENTITIES.findIndex((x) => x.id === id);
    if (idx === -1) return null;
    const current = MOCK_RESERVATION_ENTITIES[idx];
    if (user.scope !== 'platform' && user.clientId !== current.clientId) return null;
    if (user.internalRole !== 'BUILDING_ADMIN') throw new Error('No autorizado');
    if (!assignmentsRepo.isAssignedToBuilding(user, current.buildingId)) throw new Error('No autorizado');
    if (current.status !== 'REQUESTED') throw new Error('No autorizado');

    const now = new Date().toISOString();
    const updated: ReservationEntity = { ...current, status: 'REJECTED', updatedAt: now };
    MOCK_RESERVATION_ENTITIES[idx] = updated;

    auditService.logAction({
      userId: user.id,
      clientId: updated.clientId,
      action: 'UPDATE',
      entity: 'Reservation',
      entityId: updated.id,
      oldData: current,
      newData: updated,
      metadata: { buildingId: updated.buildingId, unitId: updated.unitId, commonAreaId: updated.commonAreaId },
    });

    return updated;
  },
};

