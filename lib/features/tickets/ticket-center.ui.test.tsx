import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AdminTicketComposerDialog,
  buildAdminStructuredDescription,
  buildStructuredDescription,
  getSuggestedIncidentTitle,
  ResidentTicketComposerDialog,
  StaffTicketCard,
} from './ticket-center.ui';

const baseDialogProps = {
  isOpen: true,
  isSubmitting: false,
  units: [{ id: 'unit-101', buildingId: 'b1', number: '101' }],
  buildingNameById: new Map([['b1', 'Torre Norte']]),
  unitId: '',
  problemType: '',
  whereOccurs: '',
  locationDetail: '',
  since: '',
  impact: '',
  title: '',
  additionalDetail: '',
  priority: 'MEDIUM' as const,
  error: null,
  evidenceFile: null,
  onClose: vi.fn(),
  onUnitChange: vi.fn(),
  onProblemTypeChange: vi.fn(),
  onWhereOccursChange: vi.fn(),
  onLocationDetailChange: vi.fn(),
  onSinceChange: vi.fn(),
  onImpactChange: vi.fn(),
  onTitleChange: vi.fn(),
  onAdditionalDetailChange: vi.fn(),
  onPriorityChange: vi.fn(),
  onEvidenceChange: vi.fn(),
  onSubmit: vi.fn(),
};

const baseAdminDialogProps = {
  isOpen: true,
  isSubmitting: false,
  buildings: [{ id: 'b1', name: 'Torre Norte' }],
  units: [{ id: 'unit-101', buildingId: 'b1', number: '101' }],
  buildingId: 'b1',
  unitId: '',
  problemType: '',
  whereOccurs: '',
  locationDetail: '',
  since: '',
  impact: '',
  title: '',
  additionalDetail: '',
  priority: 'MEDIUM' as const,
  error: null,
  onClose: vi.fn(),
  onBuildingChange: vi.fn(),
  onUnitChange: vi.fn(),
  onProblemTypeChange: vi.fn(),
  onWhereOccursChange: vi.fn(),
  onLocationDetailChange: vi.fn(),
  onSinceChange: vi.fn(),
  onImpactChange: vi.fn(),
  onTitleChange: vi.fn(),
  onAdditionalDetailChange: vi.fn(),
  onPriorityChange: vi.fn(),
  onSubmit: vi.fn(),
};

describe('buildAdminStructuredDescription', () => {
  it('includes linked unit when present', () => {
    const result = buildAdminStructuredDescription({
      buildingName: 'Torre A',
      unitLabel: 'Depto 101',
      problemType: 'Agua / filtración',
      whereOccurs: 'Ascensor',
      locationDetail: 'Ascensor de Torre A, entre piso 2 y 3',
      since: 'Hoy',
      impact: 'Zona común del edificio',
      additionalDetail: 'Hay olor a humedad.',
    });

    expect(result).toContain('Registrado para: Torre A');
    expect(result).toContain('Unidad vinculada: Depto 101');
    expect(result).toContain('Tipo de problema: Agua / filtración');
    expect(result).toContain('Dónde ocurre: Ascensor');
    expect(result).toContain('Lugar específico: Ascensor de Torre A, entre piso 2 y 3');
    expect(result).toContain('Desde cuándo ocurre: Hoy');
    expect(result).toContain('Afectación: Zona común del edificio');
    expect(result).toContain('---');
    expect(result).toContain('Detalle adicional:');
  });

  it('omits linked unit and separator when they do not apply', () => {
    const result = buildAdminStructuredDescription({
      buildingName: 'Torre A',
      unitLabel: null,
      problemType: 'Ascensor',
      whereOccurs: 'Todo el edificio',
      locationDetail: 'Ascensor principal',
      since: 'Desde ayer',
      impact: 'Todo el edificio',
      additionalDetail: '',
    });

    expect(result).toContain('Registrado para: Torre A');
    expect(result).not.toContain('Unidad vinculada:');
    expect(result).not.toContain('---');
  });
});

describe('buildStructuredDescription', () => {
  it('generates the correct format with additional detail', () => {
    const result = buildStructuredDescription({
      reportFrom: 'Torre A · Depto 101',
      problemType: 'Agua / filtración',
      whereOccurs: 'Ascensor',
      locationDetail: 'Ascensor de Torre A, entre piso 2 y 3',
      since: 'Hoy',
      impact: 'Zona común del edificio',
      additionalDetail: 'Hay fuga debajo del lavadero.',
    });

    expect(result).toContain('Reportado desde: Torre A · Depto 101');
    expect(result).toContain('Tipo de problema: Agua / filtración');
    expect(result).toContain('Dónde ocurre: Ascensor');
    expect(result).toContain('Lugar específico: Ascensor de Torre A, entre piso 2 y 3');
    expect(result).toContain('Desde cuándo ocurre: Hoy');
    expect(result).toContain('Afectación: Zona común del edificio');
    expect(result).toContain('---');
    expect(result).toContain('Detalle adicional:');
    expect(result).toContain('Hay fuga debajo del lavadero.');
  });

  it('omits separator and detail section when additionalDetail is empty', () => {
    const result = buildStructuredDescription({
      reportFrom: 'Torre Norte · Depto 101',
      problemType: 'Electricidad',
      whereOccurs: 'Dentro de mi unidad',
      locationDetail: 'Cocina principal',
      since: 'Desde ayer',
      impact: 'Mi unidad y zonas cercanas',
      additionalDetail: '',
    });

    expect(result).toContain('Reportado desde: Torre Norte · Depto 101');
    expect(result).toContain('Tipo de problema: Electricidad');
    expect(result).toContain('Dónde ocurre: Dentro de mi unidad');
    expect(result).toContain('Lugar específico: Cocina principal');
    expect(result).not.toContain('---');
    expect(result).not.toContain('Detalle adicional:');
  });

  it('omits separator when additionalDetail is only whitespace', () => {
    const result = buildStructuredDescription({
      reportFrom: 'Torre Norte · Depto 101',
      problemType: 'Ruido',
      whereOccurs: 'Pasillo / hall',
      locationDetail: 'Pasillo del piso 3',
      since: 'No estoy seguro',
      impact: 'Varias unidades',
      additionalDetail: '   ',
    });

    expect(result).not.toContain('---');
  });
});

describe('getSuggestedIncidentTitle', () => {
  it('builds a contextual title when both values are not `Otro`', () => {
    expect(getSuggestedIncidentTitle('Agua / filtración', 'Ascensor')).toBe('Agua / filtración en Ascensor');
  });

  it('uses fallback title when any value is `Otro`', () => {
    expect(getSuggestedIncidentTitle('Otro', 'Otro')).toBe('Incidencia reportada');
    expect(getSuggestedIncidentTitle('Electricidad', 'Otro')).toBe('Incidencia reportada');
  });
});

describe('ResidentTicketComposerDialog', () => {
  it('falls back to `Depto` label when resident unit has no building name', () => {
    render(
      <ResidentTicketComposerDialog
        {...baseDialogProps}
        buildingNameById={new Map()}
        unitId="unit-101"
      />
    );

    expect(screen.getByText('Depto 101')).toBeInTheDocument();
  });

  it('renders all context section labels', () => {
    render(<ResidentTicketComposerDialog {...baseDialogProps} />);

    expect(screen.getByText('Reportante')).toBeInTheDocument();
    expect(screen.getByText('Problema')).toBeInTheDocument();
    expect(screen.getByText('Contexto')).toBeInTheDocument();
    expect(screen.getByText('Detalle')).toBeInTheDocument();
  });

  it('renders all context field labels', () => {
    render(<ResidentTicketComposerDialog {...baseDialogProps} />);

    expect(screen.getByText('Reportado desde')).toBeInTheDocument();
    expect(screen.getByText('Tipo de problema')).toBeInTheDocument();
    expect(screen.getByText('Dónde ocurre')).toBeInTheDocument();
    expect(screen.getByText('Lugar específico')).toBeInTheDocument();
    expect(screen.getByText('Desde cuándo ocurre')).toBeInTheDocument();
    expect(screen.getByText('Afectación')).toBeInTheDocument();
  });

  it('renders problem type options', () => {
    render(<ResidentTicketComposerDialog {...baseDialogProps} />);

    expect(screen.getByRole('option', { name: 'Agua / filtración' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Electricidad' })).toBeInTheDocument();
  });

  it('renders where-occurs options', () => {
    render(
      <ResidentTicketComposerDialog
        {...baseDialogProps}
        units={[
          { id: 'unit-101', buildingId: 'b1', number: '101' },
          { id: 'unit-102', buildingId: 'b1', number: '102' },
        ]}
      />
    );
    const whereOccursSelect = screen.getAllByRole('combobox')[2];

    expect(whereOccursSelect).toHaveTextContent('Ascensor');
    expect(whereOccursSelect).toHaveTextContent('Área común');
    expect(whereOccursSelect).toHaveTextContent('Todo el edificio');
  });

  it('renders since options', () => {
    render(<ResidentTicketComposerDialog {...baseDialogProps} />);

    expect(screen.getByRole('option', { name: 'Hoy' })).toBeInTheDocument();
  });

  it('renders scope options', () => {
    render(<ResidentTicketComposerDialog {...baseDialogProps} />);

    expect(screen.getByRole('option', { name: 'Solo mi unidad' })).toBeInTheDocument();
  });

  it('shows report-from helper text explaining the issue can occur elsewhere', () => {
    render(<ResidentTicketComposerDialog {...baseDialogProps} />);

    expect(
      screen.getByText(
        'Usaremos esta unidad para asociar el reporte a tu cuenta. El problema puede ocurrir dentro de tu unidad o en otra zona del edificio.'
      )
    ).toBeInTheDocument();
  });

  it('shows `Lugar específico` as a free-text input', () => {
    render(<ResidentTicketComposerDialog {...baseDialogProps} />);

    expect(
      screen.getByPlaceholderText(
        'Ej. baño principal, pasillo del piso 3, ascensor de Torre A, zona de parrilla, estacionamiento B12'
      )
    ).toBeInTheDocument();
  });

  it('shows "Detalle adicional" label without "(opcional)" when problemType is Otro', () => {
    render(<ResidentTicketComposerDialog {...baseDialogProps} problemType="Otro" whereOccurs="Ascensor" />);

    expect(screen.getByText('Detalle adicional')).toBeInTheDocument();
    expect(screen.queryByText('Detalle adicional (opcional)')).not.toBeInTheDocument();
  });

  it('shows "(opcional)" in the detalle adicional label when neither is Otro', () => {
    render(
      <ResidentTicketComposerDialog
        {...baseDialogProps}
        problemType="Electricidad"
        whereOccurs="Dentro de mi unidad"
      />
    );

    expect(screen.getByText('Detalle adicional (opcional)')).toBeInTheDocument();
  });

  it('shows building + unit label in unit selector', () => {
    render(
      <ResidentTicketComposerDialog
        {...baseDialogProps}
        units={[
          { id: 'unit-101', buildingId: 'b1', number: '101' },
          { id: 'unit-102', buildingId: 'b1', number: '102' },
        ]}
      />
    );

    expect(screen.getByRole('option', { name: 'Torre Norte · Depto 101' })).toBeInTheDocument();
  });

  it('shows a fixed `Reportado desde` block when there is only one unit', () => {
    render(<ResidentTicketComposerDialog {...baseDialogProps} unitId="unit-101" />);

    expect(screen.getByText('Reportado desde')).toBeInTheDocument();
    expect(screen.getByText('Torre Norte · Depto 101')).toBeInTheDocument();
    expect(screen.queryByText('Reportar desde')).not.toBeInTheDocument();
  });

  it('shows a `Reportar desde` selector when there are multiple units', () => {
    render(
      <ResidentTicketComposerDialog
        {...baseDialogProps}
        units={[
          { id: 'unit-101', buildingId: 'b1', number: '101' },
          { id: 'unit-102', buildingId: 'b1', number: '102' },
        ]}
      />
    );

    expect(screen.getByText('Reportar desde')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(6);
  });

  it('does not render the `Resumen del reporte` block', () => {
    render(<ResidentTicketComposerDialog {...baseDialogProps} />);

    expect(screen.queryByText('Resumen del reporte')).not.toBeInTheDocument();
  });
});

describe('AdminTicketComposerDialog', () => {
  it('renders the admin context fields and does not show `Reportar desde`', () => {
    render(<AdminTicketComposerDialog {...baseAdminDialogProps} />);

    expect(screen.getByText('Edificio')).toBeInTheDocument();
    expect(screen.getByText('Unidad vinculada (opcional)')).toBeInTheDocument();
    expect(screen.getByText('Tipo de problema')).toBeInTheDocument();
    expect(screen.getByText('Dónde ocurre')).toBeInTheDocument();
    expect(screen.getByText('Lugar específico')).toBeInTheDocument();
    expect(screen.getByText('Desde cuándo ocurre')).toBeInTheDocument();
    expect(screen.getByText('Afectación')).toBeInTheDocument();
    expect(screen.queryByText('Reportar desde')).not.toBeInTheDocument();
  });

  it('renders the admin layout sections', () => {
    render(<AdminTicketComposerDialog {...baseAdminDialogProps} />);

    expect(screen.getByText('Ubicación administrativa')).toBeInTheDocument();
    expect(screen.getByText('Problema')).toBeInTheDocument();
    expect(screen.getByText('Contexto')).toBeInTheDocument();
    expect(screen.getByText('Detalle')).toBeInTheDocument();
  });

  it('renders where-occurs options for admin', () => {
    render(<AdminTicketComposerDialog {...baseAdminDialogProps} />);
    const whereOccursSelect = screen.getAllByRole('combobox')[3];

    expect(whereOccursSelect).toHaveTextContent('Dentro de una unidad');
    expect(whereOccursSelect).toHaveTextContent('Ascensor');
    expect(whereOccursSelect).toHaveTextContent('Todo el edificio');
  });

  it('renders `Lugar específico` as a free-text input for admin', () => {
    render(<AdminTicketComposerDialog {...baseAdminDialogProps} />);

    expect(
      screen.getByPlaceholderText('Ej. pasillo del piso 3, ascensor de Torre A, zona de parrilla, unidad 101')
    ).toBeInTheDocument();
  });
});

describe('ticket center ui - StaffTicketCard', () => {
  it('shows building and unit context in the staff ticket card', () => {
    render(
      <StaffTicketCard
        ticket={{
          id: 'inc_1',
          clientId: 'client_001',
          buildingId: 'b1',
          unitId: 'unit-101',
          title: 'Fuga de agua',
          description: 'Hay una fuga constante en el piso 2.',
          status: 'ASSIGNED',
          priority: 'HIGH',
          reportedByUserId: 'u_owner',
          assignedToUserId: 'u_staff',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-20T10:00:00.000Z',
          evidence: [],
        }}
        buildingName="Torre Norte"
        unitLabel="101"
        isSubmitting={false}
        selectedStatus=""
        allowedStatuses={['IN_PROGRESS', 'RESOLVED']}
        onStatusChange={vi.fn()}
        onSaveStatus={vi.fn()}
      />
    );

    expect(screen.getByText('Ubicación')).toBeInTheDocument();
    expect(screen.getByText('Torre Norte')).toBeInTheDocument();
    expect(screen.getByText('Unidad 101')).toBeInTheDocument();
  });
});
