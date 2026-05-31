import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffTicketsPage from './page';

const mocks = vi.hoisted(() => {
  const staffUser = {
    id: 'staff_1',
    email: 'staff@propsys.com',
    name: 'Staff',
    role: 'STAFF',
    internalRole: 'STAFF',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
    buildingId: 'b1',
  };

  const ticket = {
    id: 'inc_1',
    clientId: 'client_001',
    buildingId: 'b1',
    unitId: 'unit-101',
    title: 'Ascensor detenido',
    description: 'El ascensor no responde.',
    status: 'ASSIGNED',
    priority: 'HIGH',
    reportedByUserId: 'u_owner',
    assignedToUserId: 'staff_1',
    createdAt: '2026-06-20T10:00:00.000Z',
    updatedAt: '2026-06-20T11:00:00.000Z',
    evidence: [],
  };

  return {
    staffUser,
    ticket,
    loadStaffTicketsPageData: vi.fn(),
    createTicketForUser: vi.fn(),
    updateTicketStatusForUser: vi.fn(),
    refresh: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.staffUser }),
}));

vi.mock('@/lib/features/tickets/ticket-center.data', () => ({
  createTicketForUser: mocks.createTicketForUser,
  loadStaffTicketsPageData: mocks.loadStaffTicketsPageData,
  updateTicketStatusForUser: mocks.updateTicketStatusForUser,
}));

describe('staff tickets page badge refresh', () => {
  beforeEach(() => {
    mocks.refresh.mockReset();
    mocks.createTicketForUser.mockReset();
    mocks.updateTicketStatusForUser.mockReset().mockResolvedValue({
      ...mocks.ticket,
      status: 'RESOLVED',
    });
    mocks.loadStaffTicketsPageData.mockReset().mockResolvedValue({
      tickets: [mocks.ticket],
      buildings: [{ id: 'b1', name: 'Torre Norte' }],
      units: [{ id: 'unit-101', buildingId: 'b1', number: '101' }],
    });
  });

  it('refreshes after updating incident status successfully', async () => {
    render(<StaffTicketsPage />);

    const saveButton = await screen.findByRole('button', { name: 'Guardar' });
    const card = saveButton.closest('.bg-white.border.border-slate-200.rounded-2xl');
    expect(card).not.toBeNull();

    const statusSelect = within(card as HTMLElement).getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'RESOLVED' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.updateTicketStatusForUser).toHaveBeenCalledWith(mocks.staffUser, 'inc_1', 'RESOLVED');
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('does not refresh when updating incident status fails', async () => {
    mocks.updateTicketStatusForUser.mockRejectedValueOnce(new Error('boom'));
    render(<StaffTicketsPage />);

    const saveButton = await screen.findByRole('button', { name: 'Guardar' });
    const card = saveButton.closest('.bg-white.border.border-slate-200.rounded-2xl');
    expect(card).not.toBeNull();

    const statusSelect = within(card as HTMLElement).getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'RESOLVED' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.updateTicketStatusForUser).toHaveBeenCalled();
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
