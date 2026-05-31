import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminTicketsPage from './page';

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

  const ticket = {
    id: 'inc_1',
    clientId: 'client_001',
    buildingId: 'b1',
    unitId: 'unit-101',
    title: 'Filtracion en azotea',
    description: 'Hay una filtracion en el sector norte.',
    status: 'RESOLVED',
    priority: 'HIGH',
    reportedByUserId: 'u_owner',
    assignedToUserId: 'staff_1',
    createdAt: '2026-06-20T10:00:00.000Z',
    updatedAt: '2026-06-20T11:00:00.000Z',
    evidence: [],
  };

  return {
    managerUser,
    ticket,
    loadAdminTicketsPageData: vi.fn(),
    createTicketForUser: vi.fn(),
    updateTicketStatusForUser: vi.fn(),
    assignTicketForUser: vi.fn(),
  };
});

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.managerUser }),
}));

vi.mock('@/lib/features/tickets/ticket-center.data', () => ({
  assignTicketForUser: mocks.assignTicketForUser,
  createTicketForUser: mocks.createTicketForUser,
  loadAdminTicketsPageData: mocks.loadAdminTicketsPageData,
  updateTicketStatusForUser: mocks.updateTicketStatusForUser,
}));

describe('admin tickets close confirmation flow', () => {
  beforeEach(() => {
    mocks.createTicketForUser.mockReset();
    mocks.assignTicketForUser.mockReset();
    mocks.updateTicketStatusForUser.mockReset().mockImplementation(async (_user, _id, status) => ({
      ...mocks.ticket,
      status,
    }));
    mocks.loadAdminTicketsPageData.mockReset().mockResolvedValue({
      tickets: [mocks.ticket],
      buildings: [{ id: 'b1', name: 'Torre Norte' }],
      units: [{ id: 'unit-101', buildingId: 'b1', number: '101' }],
      staffByBuilding: {
        b1: [{ id: 'staff_1', buildingId: 'b1', name: 'Ana Torres', role: 'STAFF' }],
      },
      defaultCreateBuildingId: 'b1',
    });
  });

  it('shows `Cerrar incidencia` as the visible close action', async () => {
    render(<AdminTicketsPage />);

    expect(await screen.findByRole('button', { name: 'Cerrar incidencia' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cerrar$/ })).not.toBeInTheDocument();
  });

  it('opens close confirmation without executing the close action yet', async () => {
    render(<AdminTicketsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar incidencia' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Confirmar cierre de incidencia')).toBeInTheDocument();
    expect(within(dialog).getByText('Filtracion en azotea')).toBeInTheDocument();
    expect(within(dialog).getByText('Torre Norte')).toBeInTheDocument();
    expect(within(dialog).getByText('101')).toBeInTheDocument();
    expect(within(dialog).getByText('Ana Torres')).toBeInTheDocument();
    expect(mocks.updateTicketStatusForUser).not.toHaveBeenCalled();
  });

  it('does not close the incident when cancelling the confirmation', async () => {
    render(<AdminTicketsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar incidencia' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mocks.updateTicketStatusForUser).not.toHaveBeenCalled();
  });

  it('executes the close action only after confirming', async () => {
    render(<AdminTicketsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar incidencia' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar cierre' }));

    await waitFor(() => {
      expect(mocks.updateTicketStatusForUser).toHaveBeenCalledWith(mocks.managerUser, 'inc_1', 'CLOSED');
    });
  });

  it('keeps the manual status selector flow working as before', async () => {
    render(<AdminTicketsPage />);

    const closeButton = await screen.findByRole('button', { name: 'Cerrar incidencia' });
    const card = closeButton.closest('.bg-white.border.border-slate-200.rounded-2xl');
    expect(card).not.toBeNull();

    const statusSelect = within(card as HTMLElement).getAllByRole('combobox').at(-1);
    expect(statusSelect).toBeDefined();
    fireEvent.change(statusSelect as Element, { target: { value: 'RESOLVED' } });
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(mocks.updateTicketStatusForUser).toHaveBeenCalledWith(mocks.managerUser, 'inc_1', 'RESOLVED');
    });
  });
});
