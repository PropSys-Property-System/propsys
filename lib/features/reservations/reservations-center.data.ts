import { reservationsRepo } from '@/lib/repos/communication/reservations.repo';
import { commonAreasRepo } from '@/lib/repos/physical/common-areas.repo';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import type { Building, CommonArea, Reservation, ReservationEntity, Unit, User } from '@/lib/types';

export type AdminReservationsPageData = {
  reservations: Reservation[];
  units: Unit[];
  buildings: Building[];
  areas: CommonArea[];
};

export type ResidentReservationsPageData = {
  reservations: Reservation[];
  availabilityReservations: Reservation[];
  units: Unit[];
  buildings: Building[];
  areas: CommonArea[];
  defaultCreateUnitId: string;
};

export type ReservationDisplayStatus = Reservation['status'] | 'COMPLETED';

export type ReservationTimelineItem = {
  reservation: Reservation;
  displayStatus: ReservationDisplayStatus;
};

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

export function getReservationDisplayStatus(reservation: Reservation, now = Date.now()): ReservationDisplayStatus {
  if (reservation.status === 'APPROVED' && new Date(reservation.endAt).getTime() < now) {
    return 'COMPLETED';
  }
  return reservation.status;
}

export function splitReservationsByTimeline(
  reservations: Reservation[],
  now = Date.now(),
): {
  active: ReservationTimelineItem[];
  history: ReservationTimelineItem[];
} {
  const sorted = [...reservations].sort((left, right) => new Date(right.startAt).getTime() - new Date(left.startAt).getTime());
  const active: ReservationTimelineItem[] = [];
  const history: ReservationTimelineItem[] = [];

  sorted.forEach((reservation) => {
    const item = {
      reservation,
      displayStatus: getReservationDisplayStatus(reservation, now),
    };

    if (
      reservation.status === 'CANCELLED' ||
      reservation.status === 'REJECTED' ||
      new Date(reservation.endAt).getTime() < now
    ) {
      history.push(item);
      return;
    }

    active.push(item);
  });

  return { active, history };
}

export function filterAvailableAreasForSlot(
  areas: CommonArea[],
  reservations: Reservation[],
  buildingId: string,
  startAt: string,
  endAt: string,
): CommonArea[] {
  if (!buildingId || !startAt || !endAt) return areas.filter((area) => area.buildingId === buildingId);

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return areas.filter((area) => area.buildingId === buildingId);
  }

  return areas.filter((area) => {
    if (area.buildingId !== buildingId) return false;

    const hasConflict = reservations.some((reservation) => {
      if (reservation.buildingId !== buildingId) return false;
      if (reservation.commonAreaId !== area.id) return false;
      if (reservation.status === 'CANCELLED' || reservation.status === 'REJECTED') return false;
      return overlaps(start, end, new Date(reservation.startAt), new Date(reservation.endAt));
    });

    return !hasConflict;
  });
}

export type CreateReservationInput = Pick<ReservationEntity, 'buildingId' | 'unitId' | 'commonAreaId' | 'startAt' | 'endAt'>;

async function loadAreasForBuildings(user: User, buildings: Building[]): Promise<CommonArea[]> {
  const buildingIds = Array.from(new Set(buildings.map((building) => building.id)));
  const areasByBuilding = await Promise.all(buildingIds.map((buildingId) => commonAreasRepo.listForBuilding(user, buildingId)));
  return areasByBuilding.flat();
}

export async function loadAdminReservationsPageData(user: User): Promise<AdminReservationsPageData> {
  const [reservations, units, buildings] = await Promise.all([
    reservationsRepo.listForUser(user),
    unitsRepo.listForUser(user),
    buildingsRepo.listForUser(user),
  ]);

  return {
    reservations,
    units,
    buildings,
    areas: await loadAreasForBuildings(user, buildings),
  };
}

export async function loadResidentReservationsPageData(user: User): Promise<ResidentReservationsPageData> {
  const [reservations, availabilityReservations, units, buildings] = await Promise.all([
    reservationsRepo.listForUser(user),
    reservationsRepo.listAvailabilityForUser(user),
    unitsRepo.listForUser(user),
    buildingsRepo.listForUser(user),
  ]);

  return {
    reservations,
    availabilityReservations,
    units,
    buildings,
    areas: await loadAreasForBuildings(user, buildings),
    defaultCreateUnitId: units[0]?.id ?? '',
  };
}


export async function createReservationForUser(user: User, input: CreateReservationInput): Promise<ReservationEntity> {
  return reservationsRepo.createForUser(user, input);
}

export async function cancelReservationForUser(user: User, id: string, reason: string): Promise<ReservationEntity | null> {
  return reservationsRepo.cancelForUser(user, id, reason);
}

export async function approveReservationForUser(user: User, id: string): Promise<ReservationEntity | null> {
  return reservationsRepo.approveForUser(user, id);
}

export async function rejectReservationForUser(user: User, id: string, reason: string): Promise<ReservationEntity | null> {
  return reservationsRepo.rejectForUser(user, id, reason);
}
