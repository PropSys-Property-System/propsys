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
  units: Unit[];
  buildings: Building[];
  areas: CommonArea[];
  defaultCreateUnitId: string;
};

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
    defaultCreateUnitId: units[0]?.id ?? '',
  };
}

export async function listReservationsForUser(user: User): Promise<Reservation[]> {
  return reservationsRepo.listForUser(user);
}

export async function createReservationForUser(user: User, input: CreateReservationInput): Promise<ReservationEntity> {
  return reservationsRepo.createForUser(user, input);
}

export async function cancelReservationForUser(user: User, id: string): Promise<ReservationEntity | null> {
  return reservationsRepo.cancelForUser(user, id);
}

export async function approveReservationForUser(user: User, id: string): Promise<ReservationEntity | null> {
  return reservationsRepo.approveForUser(user, id);
}

export async function rejectReservationForUser(user: User, id: string): Promise<ReservationEntity | null> {
  return reservationsRepo.rejectForUser(user, id);
}
