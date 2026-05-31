import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResidentTicketsPage from './page';

const mocks = vi.hoisted(() => {
  const residentUser = {
    id: 'u_owner',
    email: 'owner@propsys.com',
    name: 'Owner',
    role: 'RESIDENT',
    internalRole: 'OWNER',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
  };

  return {
    residentUser,
    createTicketForUser: vi.fn(),
    loadResidentTicketsPageData: vi.fn(),
    uploadForIncident: vi.fn(),
  };
});

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.residentUser }),
}));

vi.mock('@/lib/features/tickets/ticket-center.data', () => ({
  createTicketForUser: mocks.createTicketForUser,
  loadResidentTicketsPageData: mocks.loadResidentTicketsPageData,
}));

vi.mock('@/lib/repos/operation/evidence.repo', () => ({
  evidenceRepo: {
    uploadForIncident: mocks.uploadForIncident,
  },
}));

describe('resident tickets reporting quality', () => {
  beforeEach(() => {
    mocks.createTicketForUser.mockReset().mockResolvedValue({
      id: 'inc_1',
      clientId: 'client_001',
      buildingId: 'b1',
      unitId: 'unit-a-101',
      title: 'Fuga de agua en baño principal',
      description: 'Hay una fuga de agua constante desde anoche.',
      status: 'REPORTED',
      priority: 'MEDIUM',
      reportedByUserId: 'u_owner',
      assignedToUserId: null,
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-20T10:00:00.000Z',
    });
    mocks.uploadForIncident.mockReset().mockResolvedValue(undefined);
    mocks.loadResidentTicketsPageData.mockReset().mockResolvedValue({
      tickets: [],
      units: [
        { id: 'unit-a-101', buildingId: 'b1', number: '101' },
        { id: 'unit-b-101', buildingId: 'b2', number: '101' },
      ],
      buildings: [
        { id: 'b1', name: 'Torre A' },
        { id: 'b2', name: 'Torre B' },
      ],
    });
  });

  async function openComposer() {
    render(<ResidentTicketsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Reportar Incidencia/i }));
    return screen.getByRole('dialog');
  }

  it('shows resident units disambiguated with building name', async () => {
    const dialog = await openComposer();
    const unitSelect = within(dialog).getAllByRole('combobox')[0];
    const options = within(unitSelect).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toContain('Torre A · Depto 101');
    expect(options.map((option) => option.textContent)).toContain('Torre B · Depto 101');
  });

  it('does not create an incident when title is shorter than 6 characters', async () => {
    const dialog = await openComposer();
    const selects = within(dialog).getAllByRole('combobox');

    fireEvent.change(selects[0], { target: { value: 'unit-a-101' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Ej. Fuga de agua en baño principal'), { target: { value: 'Agua' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Indica dónde ocurre, desde cuándo sucede y qué tan urgente parece.'), {
      target: { value: 'Hay una fuga visible desde anoche.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    expect((await within(screen.getByRole('dialog')).findAllByText('El título debe tener al menos 6 caracteres.')).length).toBeGreaterThan(0);
    expect(mocks.createTicketForUser).not.toHaveBeenCalled();
  });

  it('does not create an incident when description is shorter than 15 characters', async () => {
    const dialog = await openComposer();
    const selects = within(dialog).getAllByRole('combobox');

    fireEvent.change(selects[0], { target: { value: 'unit-a-101' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Ej. Fuga de agua en baño principal'), {
      target: { value: 'Fuga de agua' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('Indica dónde ocurre, desde cuándo sucede y qué tan urgente parece.'), {
      target: { value: 'Muy urgente' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    expect((await within(screen.getByRole('dialog')).findAllByText('La descripción debe tener al menos 15 caracteres.')).length).toBeGreaterThan(0);
    expect(mocks.createTicketForUser).not.toHaveBeenCalled();
  });

  it('creates an incident when title and description are valid', async () => {
    const dialog = await openComposer();
    const selects = within(dialog).getAllByRole('combobox');

    fireEvent.change(selects[0], { target: { value: 'unit-a-101' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Ej. Fuga de agua en baño principal'), {
      target: { value: '  Fuga de agua en baño principal  ' },
    });
    fireEvent.change(within(dialog).getByPlaceholderText('Indica dónde ocurre, desde cuándo sucede y qué tan urgente parece.'), {
      target: { value: '  Hay una fuga de agua constante en el baño principal desde anoche.  ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(mocks.createTicketForUser).toHaveBeenCalledWith(mocks.residentUser, {
        buildingId: 'b1',
        unitId: 'unit-a-101',
        title: 'Fuga de agua en baño principal',
        description: 'Hay una fuga de agua constante en el baño principal desde anoche.',
        priority: 'MEDIUM',
      });
    });
  });
});
