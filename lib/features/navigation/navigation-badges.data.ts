import { headers } from 'next/headers';
import type { IncidentEntity, Receipt, Reservation, TaskEntity, User } from '@/lib/types';
import { fetchJsonOrThrow } from '@/lib/repos/http';

export type NavigationBadgesByHref = Partial<Record<string, number>>;

type ReceiptPaymentProofView = {
  id: string;
  receiptId: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
};

type AuthHeaders = {
  cookie?: string;
};

function addBadgeIfPositive(badgesByHref: NavigationBadgesByHref, href: string, count: number) {
  if (count > 0) {
    badgesByHref[href] = count;
  }
}

async function getAuthHeaders(): Promise<AuthHeaders> {
  const cookieHeader = (await headers()).get('cookie');
  return cookieHeader ? { cookie: cookieHeader } : {};
}

async function listStaffTasksForBadges(authHeaders: AuthHeaders): Promise<TaskEntity[]> {
  const data = await fetchJsonOrThrow<{ tasks: TaskEntity[] }>('/api/v1/operation/tasks', {
    headers: authHeaders,
  });
  return data.tasks;
}

async function listStaffIncidentsForBadges(authHeaders: AuthHeaders): Promise<IncidentEntity[]> {
  const data = await fetchJsonOrThrow<{ incidents: IncidentEntity[] }>('/api/v1/operation/incidents', {
    headers: authHeaders,
  });
  return data.incidents;
}

async function listAdminRequestedReservationsForBadges(authHeaders: AuthHeaders): Promise<Reservation[]> {
  const data = await fetchJsonOrThrow<{ reservations: Reservation[] }>('/api/v1/reservations', {
    headers: authHeaders,
  });
  return data.reservations;
}

async function listAdminIncidentsForBadges(authHeaders: AuthHeaders): Promise<IncidentEntity[]> {
  const data = await fetchJsonOrThrow<{ incidents: IncidentEntity[] }>('/api/v1/operation/incidents', {
    headers: authHeaders,
  });
  return data.incidents;
}

async function listResidentReceiptsForBadges(authHeaders: AuthHeaders): Promise<Receipt[]> {
  const data = await fetchJsonOrThrow<{ receipts: Receipt[] }>('/api/v1/finance/receipts', {
    headers: authHeaders,
  });
  return data.receipts;
}

async function listAdminPendingPaymentProofs(authHeaders: AuthHeaders): Promise<ReceiptPaymentProofView[]> {
  const data = await fetchJsonOrThrow<{ proofs: ReceiptPaymentProofView[] }>('/api/v1/finance/payment-proofs?status=PENDING_REVIEW', {
    headers: authHeaders,
  });
  return data.proofs;
}

async function safeBadgeCount(loadCount: () => Promise<number>): Promise<number> {
  try {
    return await loadCount();
  } catch {
    return 0;
  }
}

export async function loadNavigationBadges(user: User): Promise<NavigationBadgesByHref> {
  const badgesByHref: NavigationBadgesByHref = {};
  const authHeaders = await getAuthHeaders();

  if (user.internalRole === 'STAFF') {
    const [taskCount, incidentCount] = await Promise.all([
      safeBadgeCount(async () => {
        const tasks = await listStaffTasksForBadges(authHeaders);
        return tasks.filter((task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS').length;
      }),
      safeBadgeCount(async () => {
        const incidents = await listStaffIncidentsForBadges(authHeaders);
        return incidents.filter((incident) => incident.status === 'ASSIGNED' || incident.status === 'IN_PROGRESS').length;
      }),
    ]);

    addBadgeIfPositive(badgesByHref, '/staff/tasks', taskCount);
    addBadgeIfPositive(badgesByHref, '/staff/tickets', incidentCount);

    return badgesByHref;
  }

  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
    const receiptCount = await safeBadgeCount(async () => {
      const receipts = await listResidentReceiptsForBadges(authHeaders);
      return receipts.filter((receipt) => receipt.status === 'PENDING' || receipt.status === 'OVERDUE').length;
    });

    addBadgeIfPositive(badgesByHref, '/resident/receipts', receiptCount);

    return badgesByHref;
  }

  if (
    user.internalRole === 'BUILDING_ADMIN' ||
    user.internalRole === 'CLIENT_MANAGER' ||
    user.internalRole === 'ROOT_ADMIN'
  ) {
    const [reservationCount, pendingProofCount, pendingIncidentCount] = await Promise.all([
      safeBadgeCount(async () => {
        const reservations = await listAdminRequestedReservationsForBadges(authHeaders);
        return reservations.filter((reservation) => reservation.status === 'REQUESTED').length;
      }),
      safeBadgeCount(async () => {
        const proofs = await listAdminPendingPaymentProofs(authHeaders);
        return proofs.filter((proof) => proof.status === 'PENDING_REVIEW').length;
      }),
      safeBadgeCount(async () => {
        const incidents = await listAdminIncidentsForBadges(authHeaders);
        return incidents.filter((incident) => incident.status === 'REPORTED' || incident.status === 'RESOLVED').length;
      }),
    ]);

    addBadgeIfPositive(badgesByHref, '/admin/reservations', reservationCount);
    addBadgeIfPositive(badgesByHref, '/admin/receipts', pendingProofCount);
    addBadgeIfPositive(badgesByHref, '/admin/tickets', pendingIncidentCount);

    return badgesByHref;
  }

  return badgesByHref;
}
