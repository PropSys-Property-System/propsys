import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminReservationCard,
  ReservationActionConfirmationDialog,
  ReservationComposerDialog,
  ReservationListSkeleton,
  ReservationsCalendarView,
  ResidentReservationCard,
  formatReservationUnitLabel,
} from './reservations-center.ui';
import type { Building, CommonArea, Reservation, Unit } from '@/lib/types';

const buildings: Building[] = [{ id: 'b1', clientId: 'client_001', name: 'Torre A', address: 'Av. 1', city: 'Lima' }];
const areas: CommonArea[] = [
  { id: 'ca-1', clientId: 'client_001', buildingId: 'b1', name: 'Terraza', requiresApproval: true },
  { id: 'ca-2', clientId: 'client_001', buildingId: 'b1', name: 'Parrilla', requiresApproval: true },
];
const units: Unit[] = [
  { id: 'unit-other', clientId: 'client_001', buildingId: 'b1', number: '202' },
  { id: 'unit-101', clientId: 'client_001', buildingId: 'b1', number: '101' },
];

describe('ReservationsCalendarView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders calendar legend with simple status labels', () => {
    render(
      <ReservationsCalendarView
        reservations={[]}
        areas={areas}
        buildings={buildings}
        units={units}
        currentUserId="u_resident"
        isAdmin={false}
      />
    );

    expect(screen.getByText('Leyenda')).toBeInTheDocument();
    expect(screen.getByText('Aprobada')).toBeInTheDocument();
    expect(screen.getByText('Solicitada')).toBeInTheDocument();
    expect(screen.getByText('Ocupado')).toBeInTheDocument();
  });

  it('renders sanitized resident availability blocks with separated busy label and area name', () => {
    const busyBlock = {
      id: 'busy_1234567890abcdef',
      buildingId: 'b1',
      commonAreaId: 'ca-2',
      startAt: '2026-05-29T10:00:00',
      endAt: '2026-05-29T11:00:00',
      busy: true,
    } as unknown as Reservation;

    render(
      <ReservationsCalendarView
        reservations={[busyBlock]}
        areas={areas}
        buildings={buildings}
        units={units}
        currentUserId="u_resident"
        isAdmin={false}
      />
    );

    const timeLabel = screen.getByText('10:00 - 11:00');
    const busyCard = timeLabel.closest('.p-2\\.5');
    expect(busyCard).not.toBeNull();
    expect(within(busyCard as HTMLElement).getByText('Ocupado')).toBeInTheDocument();
    expect(within(busyCard as HTMLElement).getByText('Parrilla')).toBeInTheDocument();
    expect(screen.queryByText('Depto 202')).not.toBeInTheDocument();
    expect(screen.queryByText('u_other')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toHaveAttribute('title', 'Semana anterior');
    expect(screen.getByRole('button', { name: 'Semana siguiente' })).toHaveAttribute('title', 'Semana siguiente');
  });

  it('keeps admin view detailed for managed reservations', () => {
    const adminReservation: Reservation = {
      id: 'resv_admin',
      buildingId: 'b1',
      unitId: 'unit-101',
      commonAreaId: 'ca-1',
      createdByUserId: 'u_resident',
      startAt: '2026-05-29T10:00:00',
      endAt: '2026-05-29T11:00:00',
      status: 'APPROVED',
    };

    render(
      <ReservationsCalendarView
        reservations={[adminReservation]}
        areas={areas}
        buildings={buildings}
        units={units}
        currentUserId="u_manager"
        isAdmin={true}
      />
    );

    expect(screen.getByText('Terraza')).toBeInTheDocument();
    expect(screen.getByText('Depto 101')).toBeInTheDocument();
  });
});

describe('ReservationListSkeleton', () => {
  it('announces loading once while reserving both list sections', () => {
    render(<ReservationListSkeleton />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cargando reservas...');
    expect(screen.getAllByText(/Reservas activas|Historial/)).toHaveLength(2);
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});

describe('reservation reason UI', () => {
  it('keeps cancel actions accessible inside a vertically constrained modal', () => {
    const onConfirm = vi.fn();
    render(
      <ReservationActionConfirmationDialog
        isOpen
        isSubmitting={false}
        action="CANCEL"
        areaName="Terraza"
        buildingName="Torre A"
        unitLabel="Depto 101"
        startAt="2026-05-29T10:00:00"
        endAt="2026-05-29T11:00:00"
        reason="Motivo suficientemente claro."
        onClose={vi.fn()}
        onReasonChange={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-h-[90vh]');
    expect(dialog.querySelector('.overflow-y-auto')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirmar cancelaci.n/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows textarea only for reject and cancel actions', () => {
    const onReasonChange = vi.fn();

    const { rerender } = render(
      <ReservationActionConfirmationDialog
        isOpen
        isSubmitting={false}
        action="REJECT"
        areaName="Terraza"
        buildingName="Torre A"
        unitLabel="Depto 101"
        startAt="2026-05-29T10:00:00"
        endAt="2026-05-29T11:00:00"
        reason=""
        onClose={() => undefined}
        onReasonChange={onReasonChange}
        onConfirm={() => undefined}
      />
    );

    expect(screen.getByLabelText('Motivo')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Motivo suficientemente claro.' } });
    expect(onReasonChange).toHaveBeenCalledWith('Motivo suficientemente claro.');

    rerender(
      <ReservationActionConfirmationDialog
        isOpen
        isSubmitting={false}
        action="APPROVE"
        areaName="Terraza"
        buildingName="Torre A"
        unitLabel="Depto 101"
        startAt="2026-05-29T10:00:00"
        endAt="2026-05-29T11:00:00"
        reason=""
        onClose={() => undefined}
        onReasonChange={onReasonChange}
        onConfirm={() => undefined}
      />
    );

    expect(screen.queryByLabelText('Motivo')).not.toBeInTheDocument();
  });

  it('renders status reason on admin and resident cards for rejected/cancelled reservations', () => {
    const rejectedReservation: Reservation = {
      id: 'resv_reason',
      buildingId: 'b1',
      unitId: 'unit-101',
      commonAreaId: 'ca-1',
      createdByUserId: 'u_resident',
      startAt: '2026-05-29T10:00:00',
      endAt: '2026-05-29T11:00:00',
      status: 'REJECTED',
      statusReason: 'El área común no está disponible por mantenimiento.',
    };

    const { rerender } = render(
      <AdminReservationCard
        reservation={rejectedReservation}
        displayStatus="REJECTED"
        areaName="Terraza"
        unitLabel="Depto 101"
        buildingName="Torre A"
        canManage={false}
        isSubmitting={false}
        onApprove={() => undefined}
        onReject={() => undefined}
        onCancel={() => undefined}
      />
    );

    expect(screen.getByText('Motivo')).toBeInTheDocument();
    expect(screen.getByText('El área común no está disponible por mantenimiento.')).toBeInTheDocument();

    rerender(
      <ResidentReservationCard
        reservation={{ ...rejectedReservation, status: 'CANCELLED', statusReason: 'El residente solicitó cancelar la reserva.' }}
        displayStatus="CANCELLED"
        areaName="Terraza"
        unitLabel="Depto 101"
        buildingName="Torre A"
        canCancel={false}
        isSubmitting={false}
        onCancel={() => undefined}
      />
    );

    expect(screen.getByText('El residente solicitó cancelar la reserva.')).toBeInTheDocument();
  });
});

describe('reservation composer modal layout', () => {
  it('formats duplicate unit numbers with their building names and preserves the selected unit id', () => {
    const onUnitChange = vi.fn();
    render(
      <ReservationComposerDialog
        isOpen
        isSubmitting={false}
        units={[
          { id: 'unit-a-101', clientId: 'client_001', buildingId: 'b1', number: '101' },
          { id: 'unit-b-101', clientId: 'client_001', buildingId: 'b2', number: '101' },
        ]}
        buildingNameById={new Map([
          ['b1', 'Torre A'],
          ['b2', 'Torre B'],
        ])}
        availableAreas={areas}
        buildingAreas={areas}
        availabilityReservations={[]}
        buildingId="b1"
        unitId="unit-a-101"
        areaId=""
        startAt=""
        endAt=""
        onClose={() => undefined}
        onUnitChange={onUnitChange}
        onAreaChange={() => undefined}
        onStartChange={() => undefined}
        onEndChange={() => undefined}
        onSubmit={() => undefined}
      />
    );

    expect(screen.getByRole('option', { name: 'Torre A · Depto 101' })).toHaveValue('unit-a-101');
    expect(screen.getByRole('option', { name: 'Torre B · Depto 101' })).toHaveValue('unit-b-101');

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'unit-b-101' } });
    expect(onUnitChange).toHaveBeenCalledWith('unit-b-101');
  });

  it('falls back to a department label when a building name is unavailable', () => {
    expect(
      formatReservationUnitLabel(
        { id: 'unit-101', clientId: 'client_001', buildingId: 'missing-building', number: '101' },
        new Map()
      )
    ).toBe('Depto 101');
  });

  it('keeps submit and cancel buttons rendered when the visual agenda is visible', () => {
    render(
      <ReservationComposerDialog
        isOpen
        isSubmitting={false}
        units={units}
        buildingNameById={new Map([['b1', 'Torre A']])}
        availableAreas={areas}
        buildingAreas={areas}
        availabilityReservations={[
          {
            id: 'resv-board',
            buildingId: 'b1',
            unitId: 'unit-101',
            commonAreaId: 'ca-1',
            createdByUserId: 'u_resident',
            startAt: '2026-05-29T10:00:00',
            endAt: '2026-05-29T12:00:00',
            status: 'APPROVED',
          },
        ]}
        buildingId="b1"
        unitId="unit-101"
        areaId="ca-1"
        startAt="2026-05-29T10:00"
        endAt="2026-05-29T12:00"
        onClose={() => undefined}
        onUnitChange={() => undefined}
        onAreaChange={() => undefined}
        onStartChange={() => undefined}
        onEndChange={() => undefined}
        onSubmit={() => undefined}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-h-[90vh]');
    expect(dialog.className).toContain('max-w-4xl');
    expect(screen.getByText('Agenda visual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reservar' })).toBeInTheDocument();
  });
});
