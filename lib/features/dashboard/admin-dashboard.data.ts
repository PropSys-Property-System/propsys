import { reservationsRepo } from '@/lib/repos/communication/reservations.repo';
import { receiptsRepo } from '@/lib/repos/finance/receipts.repo';
import { checklistExecutionsRepo } from '@/lib/repos/operation/checklist-executions.repo';
import { checklistTemplatesRepo } from '@/lib/repos/operation/checklist-templates.repo';
import { incidentsRepo } from '@/lib/repos/operation/incidents.repo';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { commonAreasRepo } from '@/lib/repos/physical/common-areas.repo';
import type { ChecklistExecution, CommonArea, IncidentEntity, Receipt, Reservation, User } from '@/lib/types';

export type AdminDashboardActivityItem = {
  id: string;
  type: 'receipt' | 'incident' | 'reservation';
  title: string;
  subtitle: string;
  timestamp: string;
  href: string;
  status: string;
};

export type AdminDashboardAgendaReservation = {
  id: string;
  commonAreaName: string;
  buildingName: string;
  startAt: string;
  endAt: string;
  status: Reservation['status'];
  href: string;
};

export type AdminDashboardData = {
  buildingsCount: number;
  buildingNameById: Record<string, string>;
  pendingReceiptsCount: number;
  openIncidentsCount: number;
  requestedReservationsCount: number;
  recentActivity: AdminDashboardActivityItem[];
  receiptStatusCounts: {
    pending: number;
    overdue: number;
    paid: number;
    cancelled: number;
  };
  agendaReservations: AdminDashboardAgendaReservation[];
  checklistsToApprove: ChecklistExecution[];
  templateNameById: Record<string, string>;
  checklistError: string | null;
};

function buildRecentActivity(
  receipts: Receipt[],
  incidents: IncidentEntity[],
  reservations: Reservation[],
  buildingNameById: Record<string, string>,
  commonAreaNameById: Record<string, string>,
): AdminDashboardActivityItem[] {
  const receiptItems: AdminDashboardActivityItem[] = receipts.map((receipt) => ({
    id: `receipt-${receipt.id}`,
    type: 'receipt',
    title: receipt.description,
    subtitle: receipt.number,
    timestamp: receipt.issueDate,
    href: `/admin/receipts/${receipt.id}`,
    status: receipt.status,
  }));

  const incidentItems: AdminDashboardActivityItem[] = incidents.map((incident) => ({
    id: `incident-${incident.id}`,
    type: 'incident',
    title: incident.title,
    subtitle: buildingNameById[incident.buildingId] ?? 'Incidencia operativa',
    timestamp: incident.updatedAt || incident.createdAt,
    href: '/admin/tickets',
    status: incident.status,
  }));

  const reservationItems: AdminDashboardActivityItem[] = reservations.map((reservation) => ({
    id: `reservation-${reservation.id}`,
    type: 'reservation',
    title: commonAreaNameById[reservation.commonAreaId] ?? 'Reserva de area comun',
    subtitle: buildingNameById[reservation.buildingId] ?? 'Reserva',
    timestamp: reservation.startAt,
    href: '/admin/reservations',
    status: reservation.status,
  }));

  return [...receiptItems, ...incidentItems, ...reservationItems]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 6);
}

function buildAgendaReservations(
  reservations: Reservation[],
  buildingNameById: Record<string, string>,
  commonAreaNameById: Record<string, string>,
): AdminDashboardAgendaReservation[] {
  const now = Date.now();

  return reservations
    .filter((reservation) => reservation.status !== 'CANCELLED' && reservation.status !== 'REJECTED')
    .filter((reservation) => new Date(reservation.endAt).getTime() >= now)
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
    .slice(0, 4)
    .map((reservation) => ({
      id: reservation.id,
      commonAreaName: commonAreaNameById[reservation.commonAreaId] ?? 'Area comun',
      buildingName: buildingNameById[reservation.buildingId] ?? 'Edificio',
      startAt: reservation.startAt,
      endAt: reservation.endAt,
      status: reservation.status,
      href: '/admin/reservations',
    }));
}

export async function loadAdminDashboardData(user: User): Promise<AdminDashboardData> {
  const [buildings, receipts, incidents, reservations] = await Promise.all([
    buildingsRepo.listForUser(user),
    receiptsRepo.listForUser(user),
    incidentsRepo.listForUser(user),
    reservationsRepo.listForUser(user),
  ]);

  const buildingNameById = Object.fromEntries(buildings.map((building) => [building.id, building.name]));
  const commonAreas = (
    await Promise.all(buildings.map((building) => commonAreasRepo.listForBuilding(user, building.id).catch(() => [] as CommonArea[])))
  ).flat();
  const commonAreaNameById = Object.fromEntries(commonAreas.map((area) => [area.id, area.name]));

  const baseData: AdminDashboardData = {
    buildingsCount: buildings.length,
    buildingNameById,
    pendingReceiptsCount: receipts.filter((receipt) => receipt.status === 'PENDING').length,
    openIncidentsCount: incidents.filter((incident) => incident.status !== 'CLOSED').length,
    requestedReservationsCount: reservations.filter((reservation) => reservation.status === 'REQUESTED').length,
    recentActivity: buildRecentActivity(receipts, incidents, reservations, buildingNameById, commonAreaNameById),
    receiptStatusCounts: {
      pending: receipts.filter((receipt) => receipt.status === 'PENDING').length,
      overdue: receipts.filter((receipt) => receipt.status === 'OVERDUE').length,
      paid: receipts.filter((receipt) => receipt.status === 'PAID').length,
      cancelled: receipts.filter((receipt) => receipt.status === 'CANCELLED').length,
    },
    agendaReservations: buildAgendaReservations(reservations, buildingNameById, commonAreaNameById),
    checklistsToApprove: [],
    templateNameById: {},
    checklistError: null,
  };

  if (user.internalRole !== 'BUILDING_ADMIN') {
    return baseData;
  }

  try {
    const [executions, templates] = await Promise.all([
      checklistExecutionsRepo.listForUser(user),
      checklistTemplatesRepo.listForUser(user),
    ]);

    return {
      ...baseData,
      checklistsToApprove: executions.filter((execution) => execution.status === 'COMPLETED').slice(0, 8),
      templateNameById: Object.fromEntries(templates.map((template) => [template.id, template.name])),
    };
  } catch {
    return {
      ...baseData,
      checklistError: 'No pudimos cargar los checklists por aprobar.',
    };
  }
}

export async function approveAdminDashboardChecklist(user: User, checklistExecutionId: string): Promise<ChecklistExecution[]> {
  await checklistExecutionsRepo.approveForUser(user, checklistExecutionId);
  const refreshedExecutions = await checklistExecutionsRepo.listForUser(user);
  return refreshedExecutions.filter((execution) => execution.status === 'COMPLETED').slice(0, 8);
}
