import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminReservationsPage from './page';

const mocks = vi.hoisted(() => {
  const managerUser = {
    id: 'u_manager',
    email: 'manager@propsys.com',
    name: 'Manager',
    role: 'MANAGER',
    internalRole: 'CLIENT_MANAGER',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
  };

  const reservation = {
    id: 'resv_1',
    buildingId: 'b1',
    unitId: 'unit-101',
    commonAreaId: 'ca-1',
    createdByUserId: 'u_owner',
    startAt: '2026-06-20T10:00:00.000Z',
    endAt: '2026-06-20T12:00:00.000Z',
    status: 'REQUESTED',
  };

  const unit = {
    id: 'unit-101',
    clientId: 'client_001',
    buildingId: 'b1',
    number: '101',
    floor: '1',
    status: 'ACTIVE',
  };

  const building = {
    id: 'b1',
    clientId: 'client_001',
    name: 'Torre Norte',
    address: 'Av. Principal 123',
    city: 'Lima',
    status: 'ACTIVE',
  };

  const area = {
    id: 'ca-1',
    clientId: 'client_001',
    buildingId: 'b1',
    name: 'Terraza',
    capacity: 20,
    requiresApproval: true,
  };

  return {
    managerUser,
    reservation,
    pageData: {
      reservations: [reservation],
      units: [unit],
      buildings: [building],
      areas: [area],
    },
    approveReservationForUser: vi.fn(),
    cancelReservationForUser: vi.fn(),
    loadAdminReservationsPageData: vi.fn(),
    rejectReservationForUser: vi.fn(),
    splitReservationsByTimeline: vi.fn(),
  };
});

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.managerUser }),
}));

vi.mock('@/lib/features/reservations/reservations-center.data', () => ({
  approveReservationForUser: mocks.approveReservationForUser,
  cancelReservationForUser: mocks.cancelReservationForUser,
  loadAdminReservationsPageData: mocks.loadAdminReservationsPageData,
  rejectReservationForUser: mocks.rejectReservationForUser,
  splitReservationsByTimeline: mocks.splitReservationsByTimeline,
}));

describe('admin reservations confirmation flow', () => {
  beforeEach(() => {
    mocks.approveReservationForUser.mockReset().mockResolvedValue({ id: 'resv_1', status: 'APPROVED' });
    mocks.rejectReservationForUser.mockReset().mockResolvedValue({ id: 'resv_1', status: 'REJECTED' });
    mocks.cancelReservationForUser.mockReset().mockResolvedValue({ id: 'resv_1', status: 'CANCELLED' });
    mocks.loadAdminReservationsPageData.mockReset().mockResolvedValue(mocks.pageData);
    mocks.splitReservationsByTimeline.mockReset().mockImplementation((reservations) => ({
      active: reservations.map((reservation: typeof mocks.reservation) => ({
        reservation,
        displayStatus: reservation.status,
      })),
      history: [],
    }));
  });

  it('opens approval confirmation without executing the action yet', async () => {
    render(<AdminReservationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirmar aprobación' })).toBeInTheDocument();
    expect(within(dialog).getByText('Terraza')).toBeInTheDocument();
    expect(mocks.approveReservationForUser).not.toHaveBeenCalled();
  });

  it('executes approval only after confirming', async () => {
    render(<AdminReservationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar aprobación' }));

    await waitFor(() => {
      expect(mocks.approveReservationForUser).toHaveBeenCalledWith(mocks.managerUser, 'resv_1');
    });
  });

  it('opens reject confirmation without executing the action yet', async () => {
    render(<AdminReservationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirmar rechazo' })).toBeInTheDocument();
    expect(mocks.rejectReservationForUser).not.toHaveBeenCalled();
  });

  it('closes reject confirmation without executing the action', async () => {
    render(<AdminReservationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mocks.rejectReservationForUser).not.toHaveBeenCalled();
  });

  it('opens cancel confirmation without executing the action yet', async () => {
    render(<AdminReservationsPage />);

    fireEvent.click((await screen.findAllByRole('button', { name: 'Cancelar' }))[0]);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirmar cancelación' })).toBeInTheDocument();
    expect(mocks.cancelReservationForUser).not.toHaveBeenCalled();
  });
});
