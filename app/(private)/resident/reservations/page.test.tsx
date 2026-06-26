import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResidentReservationsPage from './page';

const mocks = vi.hoisted(() => {
  const residentUser = {
    id: 'u_resident',
    email: 'tenant@propsys.com',
    name: 'Resident',
    role: 'TENANT',
    internalRole: 'OCCUPANT',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
  };

  const reservation = {
    id: 'resv_1',
    buildingId: 'b1',
    unitId: 'unit-101',
    commonAreaId: 'ca-1',
    createdByUserId: 'u_resident',
    startAt: '2099-06-20T10:00:00.000Z',
    endAt: '2099-06-20T12:00:00.000Z',
    status: 'APPROVED',
    statusReason: null,
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
    residentUser,
    reservation,
    pageData: {
      reservations: [reservation],
      availabilityReservations: [],
      units: [unit],
      buildings: [building],
      areas: [area],
      defaultCreateUnitId: unit.id,
    },
    cancelReservationForUser: vi.fn(),
    createReservationForUser: vi.fn(),
    filterAvailableAreasForSlot: vi.fn(),
    loadResidentReservationsPageData: vi.fn(),
    splitReservationsByTimeline: vi.fn(),
  };
});

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.residentUser }),
}));

vi.mock('@/lib/features/reservations/reservations-center.data', () => ({
  cancelReservationForUser: mocks.cancelReservationForUser,
  createReservationForUser: mocks.createReservationForUser,
  filterAvailableAreasForSlot: mocks.filterAvailableAreasForSlot,
  loadResidentReservationsPageData: mocks.loadResidentReservationsPageData,
  splitReservationsByTimeline: mocks.splitReservationsByTimeline,
}));

describe('resident reservations confirmation flow', () => {
  beforeEach(() => {
    mocks.cancelReservationForUser.mockReset().mockResolvedValue({ id: 'resv_1', status: 'CANCELLED' });
    mocks.createReservationForUser.mockReset().mockResolvedValue({ id: 'resv_created' });
    mocks.filterAvailableAreasForSlot.mockReset().mockReturnValue([mocks.pageData.areas[0]]);
    mocks.loadResidentReservationsPageData.mockReset().mockResolvedValue(mocks.pageData);
    mocks.splitReservationsByTimeline.mockReset().mockImplementation((reservations) => ({
      active: reservations.map((reservation: typeof mocks.reservation) => ({
        reservation,
        displayStatus: reservation.status,
      })),
      history: [],
    }));
  });

  it('renders an accessible list skeleton without empty states while loading', () => {
    mocks.loadResidentReservationsPageData.mockImplementationOnce(() => new Promise(() => undefined));

    render(<ResidentReservationsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando reservas...');
    expect(screen.queryByText('Sin reservas activas')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin historial')).not.toBeInTheDocument();
  });

  it('opens cancel confirmation and requires reason before executing', async () => {
    render(<ResidentReservationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar cancelación' })).toBeInTheDocument();
    expect(screen.getByLabelText('Motivo')).toBeInTheDocument();
    expect(screen.getByText('Debes ingresar un motivo.')).toBeInTheDocument();
    expect(mocks.cancelReservationForUser).not.toHaveBeenCalled();
  });

  it('executes cancellation only after confirming', async () => {
    render(<ResidentReservationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'El residente solicitó cancelar la reserva.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));

    await waitFor(() => {
      expect(mocks.cancelReservationForUser).toHaveBeenCalledWith(
        mocks.residentUser,
        'resv_1',
        'El residente solicitó cancelar la reserva.'
      );
    });
  });

  it('renders status reason for own cancelled or rejected reservations', async () => {
    const historicalReservation = {
      ...mocks.reservation,
      id: 'resv_history',
      status: 'CANCELLED',
      statusReason: 'El residente solicitó cancelar la reserva.',
    };
    mocks.loadResidentReservationsPageData.mockResolvedValue({
      ...mocks.pageData,
      reservations: [historicalReservation],
    });
    mocks.splitReservationsByTimeline.mockImplementation(() => ({
      active: [],
      history: [
        {
          reservation: historicalReservation,
          displayStatus: 'CANCELLED',
        },
      ],
    }));

    render(<ResidentReservationsPage />);

    expect(await screen.findByText('Motivo')).toBeInTheDocument();
    expect(screen.getByText('El residente solicitó cancelar la reserva.')).toBeInTheDocument();
  });

  it('creates a reservation with the selected unit id when duplicate unit numbers exist in different buildings', async () => {
    mocks.loadResidentReservationsPageData.mockResolvedValue({
      ...mocks.pageData,
      units: [
        mocks.pageData.units[0],
        {
          ...mocks.pageData.units[0],
          id: 'unit-b-101',
          buildingId: 'b2',
        },
      ],
      buildings: [
        mocks.pageData.buildings[0],
        {
          ...mocks.pageData.buildings[0],
          id: 'b2',
          name: 'Torre Sur',
        },
      ],
    });

    render(<ResidentReservationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nueva reserva' }));
    const dialog = screen.getByRole('dialog');
    const selects = within(dialog).getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'unit-b-101' } });
    fireEvent.change(selects[1], { target: { value: 'ca-1' } });
    fireEvent.change(within(dialog).getByLabelText('Fecha'), { target: { value: '2099-06-20' } });
    fireEvent.change(within(dialog).getByLabelText('Inicio'), { target: { value: '10:15' } });
    fireEvent.change(within(dialog).getByLabelText('Termino'), { target: { value: '12:45' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reservar' }));

    await waitFor(() => {
      expect(mocks.createReservationForUser).toHaveBeenCalledWith(
        mocks.residentUser,
        expect.objectContaining({
          buildingId: 'b2',
          unitId: 'unit-b-101',
          commonAreaId: 'ca-1',
          startAt: new Date('2099-06-20T10:15').toISOString(),
          endAt: new Date('2099-06-20T12:45').toISOString(),
        })
      );
    });
  });

  it('blocks creation when the end time is not after the start time', async () => {
    render(<ResidentReservationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nueva reserva' }));
    const dialog = screen.getByRole('dialog');
    const selects = within(dialog).getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'ca-1' } });
    fireEvent.change(within(dialog).getByLabelText('Fecha'), { target: { value: '2099-06-20' } });
    fireEvent.change(within(dialog).getByLabelText('Inicio'), { target: { value: '12:45' } });
    fireEvent.change(within(dialog).getByLabelText('Termino'), { target: { value: '10:15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reservar' }));

    expect(await screen.findByText('La hora de inicio debe ser anterior al término.')).toBeInTheDocument();
    expect(mocks.createReservationForUser).not.toHaveBeenCalled();
  });
});
