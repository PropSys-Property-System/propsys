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
    mocks.createTicketForUser.mockReset().mockResolvedValue({
      ...mocks.ticket,
      status: 'REPORTED',
      title: 'Agua / filtración en Ascensor',
      description:
        'Registrado para: Torre Norte\nTipo de problema: Agua / filtración\nDónde ocurre: Ascensor\nLugar específico: Ascensor de Torre Norte, entre piso 2 y 3\nDesde cuándo ocurre: Hoy\nAfectación: Zona común del edificio',
    });
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

  async function openCreateComposer() {
    render(<AdminTicketsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva incidencia' }));
    return screen.getByRole('dialog');
  }

  function getCreateSelects(dialog: HTMLElement) {
    return within(dialog).getAllByRole('combobox');
  }

  function fillCreateFields(
    dialog: HTMLElement,
    overrides: {
      buildingId?: string;
      unitId?: string;
      problemType?: string;
      whereOccurs?: string;
      locationDetail?: string;
      since?: string;
      impact?: string;
      title?: string;
      additionalDetail?: string;
    } = {}
  ) {
    const selects = getCreateSelects(dialog);

    fireEvent.change(selects[0], { target: { value: overrides.buildingId ?? 'b1' } });
    if (overrides.unitId !== undefined) {
      fireEvent.change(selects[1], { target: { value: overrides.unitId } });
    }
    fireEvent.change(selects[2], { target: { value: overrides.problemType ?? 'Agua / filtración' } });
    fireEvent.change(selects[3], { target: { value: overrides.whereOccurs ?? 'Ascensor' } });
    fireEvent.change(selects[4], { target: { value: overrides.since ?? 'Hoy' } });
    fireEvent.change(selects[5], { target: { value: overrides.impact ?? 'Zona común del edificio' } });

    fireEvent.change(
      within(dialog).getByPlaceholderText('Ej. pasillo del piso 3, ascensor de Torre A, zona de parrilla, unidad 101'),
      {
        target: { value: overrides.locationDetail ?? 'Ascensor de Torre Norte, entre piso 2 y 3' },
      }
    );

    fireEvent.change(within(dialog).getByPlaceholderText('Ej. Fuga de agua en ascensor principal'), {
      target: { value: overrides.title ?? 'Agua / filtración en Ascensor' },
    });

    if (overrides.additionalDetail !== undefined) {
      fireEvent.change(within(dialog).getByPlaceholderText('El ascensor se detiene y hay olor a humedad.'), {
        target: { value: overrides.additionalDetail },
      });
    }
  }

  it('renders the admin composer context fields', async () => {
    const dialog = await openCreateComposer();

    expect(within(dialog).getByText('Edificio')).toBeInTheDocument();
    expect(within(dialog).getByText('Unidad vinculada (opcional)')).toBeInTheDocument();
    expect(within(dialog).getByText('Tipo de problema')).toBeInTheDocument();
    expect(within(dialog).getByText('Dónde ocurre')).toBeInTheDocument();
    expect(within(dialog).getByText('Lugar específico')).toBeInTheDocument();
    expect(within(dialog).getByText('Desde cuándo ocurre')).toBeInTheDocument();
    expect(within(dialog).getByText('Afectación')).toBeInTheDocument();
    expect(within(dialog).queryByText('Reportar desde')).not.toBeInTheDocument();
  });

  it('does not create if type is missing', async () => {
    const dialog = await openCreateComposer();
    const selects = getCreateSelects(dialog);

    fireEvent.change(selects[0], { target: { value: 'b1' } });
    fireEvent.change(selects[3], { target: { value: 'Ascensor' } });
    fireEvent.change(selects[4], { target: { value: 'Hoy' } });
    fireEvent.change(selects[5], { target: { value: 'Zona común del edificio' } });
    fireEvent.change(
      within(dialog).getByPlaceholderText('Ej. pasillo del piso 3, ascensor de Torre A, zona de parrilla, unidad 101'),
      { target: { value: 'Ascensor principal' } }
    );
    fireEvent.change(within(dialog).getByPlaceholderText('Ej. Fuga de agua en ascensor principal'), {
      target: { value: 'Agua en ascensor' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('does not create if where-occurs is missing', async () => {
    const dialog = await openCreateComposer();
    const selects = getCreateSelects(dialog);

    fireEvent.change(selects[0], { target: { value: 'b1' } });
    fireEvent.change(selects[2], { target: { value: 'Agua / filtración' } });
    fireEvent.change(selects[4], { target: { value: 'Hoy' } });
    fireEvent.change(selects[5], { target: { value: 'Zona común del edificio' } });
    fireEvent.change(
      within(dialog).getByPlaceholderText('Ej. pasillo del piso 3, ascensor de Torre A, zona de parrilla, unidad 101'),
      { target: { value: 'Ascensor principal' } }
    );
    fireEvent.change(within(dialog).getByPlaceholderText('Ej. Fuga de agua en ascensor principal'), {
      target: { value: 'Agua en ascensor' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('does not create if specific place is missing', async () => {
    const dialog = await openCreateComposer();
    const selects = getCreateSelects(dialog);

    fireEvent.change(selects[0], { target: { value: 'b1' } });
    fireEvent.change(selects[2], { target: { value: 'Agua / filtración' } });
    fireEvent.change(selects[3], { target: { value: 'Ascensor' } });
    fireEvent.change(selects[4], { target: { value: 'Hoy' } });
    fireEvent.change(selects[5], { target: { value: 'Zona común del edificio' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Ej. Fuga de agua en ascensor principal'), {
      target: { value: 'Agua en ascensor' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('does not create if specific place is shorter than 4 characters', async () => {
    const dialog = await openCreateComposer();
    fillCreateFields(dialog, { locationDetail: 'abc' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('does not create if title is shorter than 6 characters', async () => {
    const dialog = await openCreateComposer();
    fillCreateFields(dialog, { title: 'Agua' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('requires additional detail when problem type is Otro', async () => {
    const dialog = await openCreateComposer();
    fillCreateFields(dialog, { problemType: 'Otro' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('requires additional detail when where-occurs is Otro', async () => {
    const dialog = await openCreateComposer();
    fillCreateFields(dialog, { whereOccurs: 'Otro' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('does not allow a unit from another building', async () => {
    mocks.loadAdminTicketsPageData.mockResolvedValueOnce({
      tickets: [mocks.ticket],
      buildings: [
        { id: 'b1', name: 'Torre Norte' },
        { id: 'b2', name: 'Torre Sur' },
      ],
      units: [
        { id: 'unit-101', buildingId: 'b1', number: '101' },
        { id: 'unit-201', buildingId: 'b2', number: '201' },
      ],
      staffByBuilding: {
        b1: [{ id: 'staff_1', buildingId: 'b1', name: 'Ana Torres', role: 'STAFF' }],
        b2: [],
      },
      defaultCreateBuildingId: 'b1',
    });

    const dialog = await openCreateComposer();
    fireEvent.change(getCreateSelects(dialog)[0], { target: { value: 'b2' } });
    fireEvent.change(getCreateSelects(dialog)[1], { target: { value: 'unit-201' } });
    fireEvent.change(getCreateSelects(dialog)[0], { target: { value: 'b1' } });
    fillCreateFields(dialog, {
      buildingId: 'b1',
      problemType: 'Agua / filtración',
      whereOccurs: 'Ascensor',
      locationDetail: 'Ascensor de Torre Norte, entre piso 2 y 3',
      since: 'Hoy',
      impact: 'Zona común del edificio',
      title: 'Agua / filtración en Ascensor',
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
    expect(screen.getAllByText('La unidad seleccionada no pertenece al edificio.').length).toBeGreaterThan(0);
  });

  it('auto-suggests title from type and location', async () => {
    const dialog = await openCreateComposer();
    const selects = getCreateSelects(dialog);

    fireEvent.change(selects[2], { target: { value: 'Agua / filtración' } });
    fireEvent.change(selects[3], { target: { value: 'Ascensor' } });

    expect((within(dialog).getByPlaceholderText('Ej. Fuga de agua en ascensor principal') as HTMLInputElement).value).toBe(
      'Agua / filtración en Ascensor'
    );
  });

  it('uses fallback title when any contextual selector is `Otro`', async () => {
    const dialog = await openCreateComposer();
    const selects = getCreateSelects(dialog);

    fireEvent.change(selects[2], { target: { value: 'Otro' } });
    fireEvent.change(selects[3], { target: { value: 'Otro' } });

    expect((within(dialog).getByPlaceholderText('Ej. Fuga de agua en ascensor principal') as HTMLInputElement).value).toBe(
      'Incidencia reportada'
    );
  });

  it('does not overwrite a manually edited title', async () => {
    const dialog = await openCreateComposer();
    const selects = getCreateSelects(dialog);
    const titleInput = within(dialog).getByPlaceholderText('Ej. Fuga de agua en ascensor principal');

    fireEvent.change(titleInput, { target: { value: 'Incidencia personalizada' } });
    fireEvent.change(selects[2], { target: { value: 'Electricidad' } });
    fireEvent.change(selects[3], { target: { value: 'Área común' } });

    expect((titleInput as HTMLInputElement).value).toBe('Incidencia personalizada');
  });

  it('creates without unit when no linked unit is selected', async () => {
    const dialog = await openCreateComposer();
    fillCreateFields(dialog);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).toHaveBeenCalled());

    expect(mocks.createTicketForUser).toHaveBeenCalledWith(
      mocks.managerUser,
      expect.objectContaining({
        buildingId: 'b1',
        unitId: undefined,
      })
    );

    const callArgs = mocks.createTicketForUser.mock.calls[0][1];
    expect(callArgs.description).toContain('Registrado para: Torre Norte');
    expect(callArgs.description).not.toContain('Unidad vinculada:');
    expect(callArgs.description).toContain('Tipo de problema: Agua / filtración');
    expect(callArgs.description).toContain('Dónde ocurre: Ascensor');
    expect(callArgs.description).toContain('Lugar específico: Ascensor de Torre Norte, entre piso 2 y 3');
    expect(callArgs.description).toContain('Desde cuándo ocurre: Hoy');
    expect(callArgs.description).toContain('Afectación: Zona común del edificio');
  });

  it('creates with unit when a valid linked unit is selected', async () => {
    const dialog = await openCreateComposer();
    fillCreateFields(dialog, { unitId: 'unit-101' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).toHaveBeenCalled());

    expect(mocks.createTicketForUser).toHaveBeenCalledWith(
      mocks.managerUser,
      expect.objectContaining({
        buildingId: 'b1',
        unitId: 'unit-101',
      })
    );

    const callArgs = mocks.createTicketForUser.mock.calls[0][1];
    expect(callArgs.description).toContain('Unidad vinculada: Depto 101');
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
