import { reservationsRepo } from '@/lib/repos/communication/reservations.repo';
import { receiptsRepo } from '@/lib/repos/finance/receipts.repo';
import { checklistExecutionsRepo } from '@/lib/repos/operation/checklist-executions.repo';
import { checklistTemplatesRepo } from '@/lib/repos/operation/checklist-templates.repo';
import { incidentsRepo } from '@/lib/repos/operation/incidents.repo';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import type { ChecklistExecution, Receipt, User } from '@/lib/types';

export type AdminDashboardData = {
  buildingsCount: number;
  buildingNameById: Record<string, string>;
  pendingReceiptsCount: number;
  openIncidentsCount: number;
  requestedReservationsCount: number;
  recentReceipts: Receipt[];
  receiptStatusCounts: {
    pending: number;
    overdue: number;
    paid: number;
    cancelled: number;
  };
  upcomingDueReceipts: Receipt[];
  checklistsToApprove: ChecklistExecution[];
  templateNameById: Record<string, string>;
  checklistError: string | null;
};

export async function loadAdminDashboardData(user: User): Promise<AdminDashboardData> {
  const [buildings, receipts, incidents, reservations] = await Promise.all([
    buildingsRepo.listForUser(user),
    receiptsRepo.listForUser(user),
    incidentsRepo.listForUser(user),
    reservationsRepo.listForUser(user),
  ]);

  const baseData: AdminDashboardData = {
    buildingsCount: buildings.length,
    buildingNameById: Object.fromEntries(buildings.map((building) => [building.id, building.name])),
    pendingReceiptsCount: receipts.filter((receipt) => receipt.status === 'PENDING').length,
    openIncidentsCount: incidents.filter((incident) => incident.status !== 'CLOSED').length,
    requestedReservationsCount: reservations.filter((reservation) => reservation.status === 'REQUESTED').length,
    recentReceipts: [...receipts]
      .sort((left, right) => new Date(right.issueDate).getTime() - new Date(left.issueDate).getTime())
      .slice(0, 5),
    receiptStatusCounts: {
      pending: receipts.filter((receipt) => receipt.status === 'PENDING').length,
      overdue: receipts.filter((receipt) => receipt.status === 'OVERDUE').length,
      paid: receipts.filter((receipt) => receipt.status === 'PAID').length,
      cancelled: receipts.filter((receipt) => receipt.status === 'CANCELLED').length,
    },
    upcomingDueReceipts: [...receipts]
      .filter((receipt) => receipt.status === 'PENDING' || receipt.status === 'OVERDUE')
      .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())
      .slice(0, 3),
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
