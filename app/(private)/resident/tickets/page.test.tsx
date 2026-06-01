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

describe('resident tickets reporting context (v1)', () => {
  beforeEach(() => {
    mocks.createTicketForUser.mockReset().mockResolvedValue({
      id: 'inc_1',
      clientId: 'client_001',
      buildingId: 'b1',
      unitId: 'unit-a-101',
      title: 'Agua / filtración en Ascensor',
      description: 'Reportado desde: Torre A · Depto 101\nTipo de problema: Agua / filtración\nDónde ocurre: Ascensor\nLugar específico: Ascensor de Torre A, entre piso 2 y 3\nDesde cuándo ocurre: Hoy\nAfectación: Zona común del edificio',
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

  function mockUnits(unitMode: 'single' | 'multiple' | 'empty') {
    const units =
      unitMode === 'single'
        ? [{ id: 'unit-a-101', buildingId: 'b1', number: '101' }]
        : unitMode === 'empty'
          ? []
          : [
              { id: 'unit-a-101', buildingId: 'b1', number: '101' },
              { id: 'unit-b-101', buildingId: 'b2', number: '101' },
            ];

    mocks.loadResidentTicketsPageData.mockResolvedValue({
      tickets: [],
      units,
      buildings: [
        { id: 'b1', name: 'Torre A' },
        { id: 'b2', name: 'Torre B' },
      ],
    });
  }

  it('renders an accessible skeleton without an empty state while loading', () => {
    mocks.loadResidentTicketsPageData.mockImplementationOnce(() => new Promise(() => undefined));

    render(<ResidentTicketsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando incidencias...');
    expect(screen.queryByText('Sin incidencias')).not.toBeInTheDocument();
  });

  async function openComposer() {
    render(<ResidentTicketsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Reportar Incidencia/i }));
    return screen.getByRole('dialog');
  }

  /** Helper: fill all required context fields in the dialog */
  function getComposerSelects(dialog: HTMLElement) {
    return within(dialog).getAllByRole('combobox');
  }

  function fillContextFields(dialog: HTMLElement, overrides: {
    unitMode?: 'single' | 'multiple';
    unitId?: string;
    problemType?: string;
    whereOccurs?: string;
    locationDetail?: string;
    since?: string;
    impact?: string;
    title?: string;
    additionalDetail?: string;
  } = {}) {
    const selects = getComposerSelects(dialog);
    const hasUnitSelect = overrides.unitMode !== 'single';
    const problemTypeIndex = hasUnitSelect ? 1 : 0;
    const whereOccursIndex = hasUnitSelect ? 2 : 1;
    const sinceIndex = hasUnitSelect ? 3 : 2;
    const impactIndex = hasUnitSelect ? 4 : 3;

    if (hasUnitSelect) {
      fireEvent.change(selects[0], { target: { value: overrides.unitId ?? 'unit-a-101' } });
    }
    fireEvent.change(selects[problemTypeIndex], { target: { value: overrides.problemType ?? 'Agua / filtración' } });
    fireEvent.change(selects[whereOccursIndex], { target: { value: overrides.whereOccurs ?? 'Ascensor' } });
    fireEvent.change(selects[sinceIndex], { target: { value: overrides.since ?? 'Hoy' } });
    fireEvent.change(selects[impactIndex], { target: { value: overrides.impact ?? 'Zona común del edificio' } });

    const locationDetailInput = within(dialog).getByPlaceholderText(
      'Ej. baño principal, pasillo del piso 3, ascensor de Torre A, zona de parrilla, estacionamiento B12'
    );
    fireEvent.change(locationDetailInput, {
      target: { value: overrides.locationDetail ?? 'Ascensor de Torre A, entre piso 2 y 3' },
    });

    const titleValue = overrides.title !== undefined ? overrides.title : 'Agua / filtración en Ascensor';
    const titleInput = within(dialog).getByPlaceholderText('Ej. Fuga de agua en baño principal');
    fireEvent.change(titleInput, { target: { value: titleValue } });

    if (overrides.additionalDetail !== undefined) {
      fireEvent.change(within(dialog).getByPlaceholderText('El ascensor se detiene y hay olor a humedad.'), {
        target: { value: overrides.additionalDetail },
      });
    }
  }

  it('shows resident units disambiguated with building name when there are multiple units', async () => {
    const dialog = await openComposer();
    const unitSelect = getComposerSelects(dialog)[0];
    const options = within(unitSelect).getAllByRole('option');

    expect(options.map((o) => o.textContent)).toContain('Torre A · Depto 101');
    expect(options.map((o) => o.textContent)).toContain('Torre B · Depto 101');
  });

  it('shows selector `Reportar desde` when resident has multiple units', async () => {
    const dialog = await openComposer();

    expect(within(dialog).getByText('Reportar desde')).toBeInTheDocument();
    expect(getComposerSelects(dialog)).toHaveLength(6);
  });

  it('shows fixed `Reportado desde` text and no unit dropdown when resident has one unit', async () => {
    mockUnits('single');
    const dialog = await openComposer();

    expect(within(dialog).getByText('Reportado desde')).toBeInTheDocument();
    expect(within(dialog).getByText('Torre A · Depto 101')).toBeInTheDocument();
    expect(getComposerSelects(dialog)).toHaveLength(5);
  });

  it('shows the helper text explaining the issue may happen elsewhere', async () => {
    const dialog = await openComposer();

    expect(
      within(dialog).getByText(
        'Usaremos esta unidad para asociar el reporte a tu cuenta. El problema puede ocurrir dentro de tu unidad o en otra zona del edificio.'
      )
    ).toBeInTheDocument();
  });

  it('shows `Dónde ocurre` options for operational context', async () => {
    const dialog = await openComposer();
    const whereOccursSelect = getComposerSelects(dialog)[2];

    expect(within(whereOccursSelect).getByRole('option', { name: 'Ascensor' })).toBeInTheDocument();
    expect(within(whereOccursSelect).getByRole('option', { name: 'Área común' })).toBeInTheDocument();
    expect(within(whereOccursSelect).getByRole('option', { name: 'Todo el edificio' })).toBeInTheDocument();
  });

  it('does not render the report summary block anymore', async () => {
    const dialog = await openComposer();

    expect(within(dialog).queryByText('Resumen del reporte')).not.toBeInTheDocument();
  });

  it('does not create an incident when context fields are missing', async () => {
    const dialog = await openComposer();
    const selects = getComposerSelects(dialog);
    fireEvent.change(selects[0], { target: { value: 'unit-a-101' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    // Validation fires synchronously — mock must NOT have been called
    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('does not create an incident when the specific place is missing', async () => {
    const dialog = await openComposer();
    const selects = getComposerSelects(dialog);

    fireEvent.change(selects[0], { target: { value: 'unit-a-101' } });
    fireEvent.change(selects[1], { target: { value: 'Agua / filtración' } });
    fireEvent.change(selects[2], { target: { value: 'Ascensor' } });
    fireEvent.change(selects[3], { target: { value: 'Hoy' } });
    fireEvent.change(selects[4], { target: { value: 'Zona común del edificio' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Ej. Fuga de agua en baño principal'), {
      target: { value: 'Agua en ascensor' },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('does not create an incident when title is shorter than 6 characters', async () => {
    const dialog = await openComposer();
    fillContextFields(dialog, { unitMode: 'multiple', title: 'Agua' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('does not create when problemType is Otro and additionalDetail is empty', async () => {
    const dialog = await openComposer();
    fillContextFields(dialog, { unitMode: 'multiple', problemType: 'Otro' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('does not create when location is Otro and additionalDetail is empty', async () => {
    const dialog = await openComposer();
    fillContextFields(dialog, { unitMode: 'multiple', whereOccurs: 'Otro' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).not.toHaveBeenCalled());
  });

  it('auto-suggests title when problemType and location are selected', async () => {
    const dialog = await openComposer();
    const selects = getComposerSelects(dialog);

    fireEvent.change(selects[1], { target: { value: 'Agua / filtración' } });
    fireEvent.change(selects[2], { target: { value: 'Ascensor' } });

    const titleInput = within(dialog).getByPlaceholderText('Ej. Fuga de agua en baño principal');
    expect((titleInput as HTMLInputElement).value).toBe('Agua / filtración en Ascensor');
  });

  it('uses the smart in-unit suggestion for resident', async () => {
    const dialog = await openComposer();
    const selects = getComposerSelects(dialog);

    fireEvent.change(selects[1], { target: { value: 'Gas' } });
    fireEvent.change(selects[2], { target: { value: 'Dentro de mi unidad' } });

    const titleInput = within(dialog).getByPlaceholderText('Ej. Fuga de agua en baño principal');
    expect((titleInput as HTMLInputElement).value).toBe('Gas dentro de mi unidad');
  });

  it('does not overwrite a manually edited title when selects change', async () => {
    const dialog = await openComposer();
    const selects = getComposerSelects(dialog);
    const titleInput = within(dialog).getByPlaceholderText('Ej. Fuga de agua en baño principal');

    // User manually enters a title first
    fireEvent.change(titleInput, { target: { value: 'Mi título personalizado' } });

    // Then selects problem and location
    fireEvent.change(selects[1], { target: { value: 'Electricidad' } });
    fireEvent.change(selects[2], { target: { value: 'Área común' } });

    // Title should NOT be overwritten
    expect((titleInput as HTMLInputElement).value).toBe('Mi título personalizado');
  });

  it('uses the fallback title instead of generating `Otro en Otro`', async () => {
    const dialog = await openComposer();
    const selects = getComposerSelects(dialog);

    fireEvent.change(selects[1], { target: { value: 'Otro' } });
    fireEvent.change(selects[2], { target: { value: 'Otro' } });

    const titleInput = within(dialog).getByPlaceholderText('Ej. Fuga de agua en baño principal');
    expect((titleInput as HTMLInputElement).value).toBe('Incidencia reportada');
    expect((titleInput as HTMLInputElement).value).not.toBe('Otro en Otro');
  });

  it('creates incident with structured description when all fields are valid', async () => {
    const dialog = await openComposer();
    fillContextFields(dialog, { unitMode: 'multiple' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(mocks.createTicketForUser).toHaveBeenCalledWith(
        mocks.residentUser,
        expect.objectContaining({
          buildingId: 'b1',
          unitId: 'unit-a-101',
          priority: 'MEDIUM',
          title: 'Agua / filtración en Ascensor',
          description: expect.stringContaining('Tipo de problema: Agua / filtración'),
        })
      );
    });

    const callArgs = mocks.createTicketForUser.mock.calls[0][1];
    expect(callArgs.description).toContain('Reportado desde: Torre A · Depto 101');
    expect(callArgs.description).toContain('Dónde ocurre: Ascensor');
    expect(callArgs.description).toContain('Lugar específico: Ascensor de Torre A, entre piso 2 y 3');
    expect(callArgs.description).toContain('Desde cuándo ocurre: Hoy');
    expect(callArgs.description).toContain('Afectación: Zona común del edificio');
    expect(callArgs.description).not.toContain('---'); // no detail added
  });

  it('creates incident with the only available unit selected automatically', async () => {
    mockUnits('single');
    const dialog = await openComposer();
    fillContextFields(dialog, { unitMode: 'single' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).toHaveBeenCalled());

    expect(mocks.createTicketForUser).toHaveBeenCalledWith(
      mocks.residentUser,
      expect.objectContaining({
        buildingId: 'b1',
        unitId: 'unit-a-101',
      })
    );
  });

  it('creates incident with the unit selected by the resident when multiple units are available', async () => {
    const dialog = await openComposer();
    fillContextFields(dialog, { unitMode: 'multiple', unitId: 'unit-b-101' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).toHaveBeenCalled());

    const callArgs = mocks.createTicketForUser.mock.calls[0][1];
    expect(callArgs.buildingId).toBe('b2');
    expect(callArgs.unitId).toBe('unit-b-101');
    expect(callArgs.description).toContain('Reportado desde: Torre B · Depto 101');
  });

  it('includes additional detail section in description when provided', async () => {
    const dialog = await openComposer();
    fillContextFields(dialog, { unitMode: 'multiple' });

    const detailTextarea = within(dialog).getByPlaceholderText('El ascensor se detiene y hay olor a humedad.');
    fireEvent.change(detailTextarea, { target: { value: 'El agua llega hasta el pasillo.' } });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => expect(mocks.createTicketForUser).toHaveBeenCalled());

    const callArgs = mocks.createTicketForUser.mock.calls[0][1];
    expect(callArgs.description).toContain('---');
    expect(callArgs.description).toContain('Detalle adicional:');
    expect(callArgs.description).toContain('El agua llega hasta el pasillo.');
  });
});
