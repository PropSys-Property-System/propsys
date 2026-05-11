import { incidentsRepo } from '@/lib/repos/operation/incidents.repo';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { staffRepo } from '@/lib/repos/physical/staff.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import type { IncidentEntity, User } from '@/lib/types';

export type TicketBuildingOption = {
  id: string;
  name: string;
};

export type TicketUnitOption = {
  id: string;
  buildingId: string;
  number: string;
};

export type TicketStaffOption = {
  id: string;
  buildingId: string;
  name: string;
  role: string;
};

export type AdminTicketsPageData = {
  tickets: IncidentEntity[];
  buildings: TicketBuildingOption[];
  units: TicketUnitOption[];
  staffByBuilding: Record<string, TicketStaffOption[]>;
  defaultCreateBuildingId: string;
};

export type ResidentTicketsPageData = {
  tickets: IncidentEntity[];
  buildings: TicketBuildingOption[];
  units: TicketUnitOption[];
};

export type StaffTicketsPageData = {
  tickets: IncidentEntity[];
  units: TicketUnitOption[];
};

export type CreateTicketInput = Pick<IncidentEntity, 'buildingId' | 'unitId' | 'title' | 'description' | 'priority'>;

export async function loadAdminTicketsPageData(user: User): Promise<AdminTicketsPageData> {
  const [tickets, buildings, units] = await Promise.all([
    incidentsRepo.listForUser(user),
    buildingsRepo.listForUser(user),
    unitsRepo.listForUser(user),
  ]);
  const staffEntries = await Promise.all(
    buildings.map(async (building) => {
      const staff = await staffRepo.listForBuilding(user, building.id).catch(() => []);
      return [
        building.id,
        staff
          .filter((member) => member.status === 'ACTIVE')
          .map((member) => ({
            id: member.id,
            buildingId: member.buildingId,
            name: member.name,
            role: member.role,
          })),
      ] as const;
    })
  );

  return {
    tickets,
    buildings: buildings.map((building) => ({ id: building.id, name: building.name })),
    units: units.map((unit) => ({ id: unit.id, buildingId: unit.buildingId, number: unit.number })),
    staffByBuilding: Object.fromEntries(staffEntries),
    defaultCreateBuildingId: buildings[0]?.id ?? '',
  };
}

export async function loadResidentTicketsPageData(user: User): Promise<ResidentTicketsPageData> {
  const [tickets, units, buildings] = await Promise.all([
    incidentsRepo.listForUser(user),
    unitsRepo.listForUser(user),
    buildingsRepo.listForUser(user),
  ]);

  return {
    tickets,
    units: units.map((unit) => ({ id: unit.id, buildingId: unit.buildingId, number: unit.number })),
    buildings: buildings.map((building) => ({ id: building.id, name: building.name })),
  };
}

export async function loadStaffTicketsPageData(user: User): Promise<StaffTicketsPageData> {
  const [tickets, units] = await Promise.all([incidentsRepo.listForUser(user), unitsRepo.listForUser(user)]);

  return {
    tickets,
    units: units.map((unit) => ({ id: unit.id, buildingId: unit.buildingId, number: unit.number })),
  };
}

export async function listTicketsForUser(user: User): Promise<IncidentEntity[]> {
  return incidentsRepo.listForUser(user);
}

export async function createTicketForUser(user: User, input: CreateTicketInput): Promise<IncidentEntity> {
  return incidentsRepo.createSimpleForUser(user, input);
}

export async function updateTicketStatusForUser(
  user: User,
  id: string,
  status: IncidentEntity['status'],
): Promise<IncidentEntity | null> {
  return incidentsRepo.updateStatusForUser(user, id, status);
}

export async function assignTicketForUser(user: User, id: string, assignedToUserId: string): Promise<IncidentEntity | null> {
  return incidentsRepo.assignForUser(user, id, assignedToUserId);
}
